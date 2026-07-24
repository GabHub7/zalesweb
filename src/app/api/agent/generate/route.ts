import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { NodeKind } from "@/types/zales";
import { getUserSettingsDecrypted, UserSettings } from "@/lib/db/users";

interface GeneratedNode {
  tempId: string;
  kind: string;
  label?: string;
  params?: Record<string, unknown>;
}
interface GeneratedEdge {
  source: string;
  target: string;
}
interface GeneratedPlan {
  name?: string;
  nodes: GeneratedNode[];
  edges: GeneratedEdge[];
}

function buildCatalogue(): string {
  return Object.values(NODE_REGISTRY)
    .map((def) => {
      const params = def.params.map((p) => `${p.key} (${p.type}${p.options ? `: ${p.options.map((o) => o.value).join("|")}` : ""})`).join(", ");
      return `- "${def.kind}" — ${def.label}: ${def.description}${params ? ` | params: ${params}` : ""}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `You are a workflow-planning engine for Zales, a visual automation tool (like n8n). Given a plain-language request from a non-technical user, output a workflow graph using ONLY the node kinds listed below.

Available node kinds:
${buildCatalogue()}

Rules:
- Output STRICT JSON only, no markdown fences, no commentary, matching exactly this shape:
{"name": "short workflow name", "nodes": [{"tempId": "n1", "kind": "trigger.manual", "label": "...", "params": {...}}], "edges": [{"source": "n1", "target": "n2"}]}
- Every workflow needs exactly one trigger node (kind starting with "trigger.") as the entry point.
- EXCEPTION: if the user wants several things to happen on different schedules (e.g. "post to Instagram every morning and TikTok every evening"), use multiple separate "trigger.schedule" nodes — one per schedule — each with its own "cron" param and its own downstream chain of nodes. A workflow can have more than one independent trigger branch when the request genuinely needs different timings.
- Once generated, this workflow gets SAVED IMMEDIATELY and its Schedule/WhatsApp/Instagram trigger nodes start firing for real on their own — there is no separate "activate" step. Because of that, never invent a schedule the user didn't specify (don't guess "every day at 9am" if they didn't say so) — ask for it in the top-level "note" field instead if it's missing and needed.
- Only use "kind" values from the catalogue above, spelled exactly as shown.
- Only set params keys that exist for that node kind in the catalogue.
- Keep it to the minimum nodes needed — don't invent extra steps the user didn't ask for.
- Use "{{input.text}}" / "{{input}}" style templates in text params to pass data from the node before it, and "{{nodes[\\"Exact Node Label\\"].field}}" to reach further back (e.g. an original trigger's data) when a node isn't directly upstream.
- If the request needs something no available node can do, still return the closest valid graph and mention the gap in a "note" field at the top level.`;

const ALLOWED_HOSTS = new Set([
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.anthropic.com",
  "api.together.xyz",
  "api.deepseek.com",
]);

function isAllowedBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return true;
    if (ALLOWED_HOSTS.has(hostname)) return true;
    // Allow common subdomains of allowed hosts
    for (const host of ALLOWED_HOSTS) {
      if (hostname.endsWith("." + host)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, baseUrl, apiKey, model, useStoredKey, settingsField } = await req.json();

    let resolvedApiKey: string = typeof apiKey === "string" ? apiKey : "";
    if (useStoredKey && typeof settingsField === "string") {
      const userId = (session.user as { id?: string } | undefined)?.id;
      const validFields = new Set<keyof UserSettings>([
        "geminiApiKey",
        "openaiApiKey",
        "customApiKey",
      ]);
      if (userId && validFields.has(settingsField as keyof UserSettings)) {
        const decrypted = await getUserSettingsDecrypted(userId);
        resolvedApiKey = decrypted[settingsField as keyof UserSettings] || "";
      }
    }
    if (!prompt || typeof prompt !== "string" || prompt.length > 10000) {
      return NextResponse.json({ error: "Prompt is required and must be under 10,000 characters." }, { status: 400 });
    }
    if (!baseUrl || typeof baseUrl !== "string" || !model || typeof model !== "string") {
      return NextResponse.json({ error: "AI provider (Base URL + Model) is required." }, { status: 400 });
    }
    if (!isAllowedBaseUrl(baseUrl)) {
      return NextResponse.json({ error: "This Base URL is not allowed." }, { status: 403 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(resolvedApiKey ? { Authorization: `Bearer ${resolvedApiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Model server returned ${res.status}: ${errText.slice(0, 200)}` },
          { status: 502 }
        );
      }

      const json = await res.json();
      const raw: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();

      let plan: GeneratedPlan;
      try {
        plan = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          { error: "The model didn't return valid JSON. Try rephrasing the prompt, or try a stronger model." },
          { status: 502 }
        );
      }

      if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) {
        return NextResponse.json({ error: "The model returned an empty plan." }, { status: 502 });
      }

      const validKinds = new Set(Object.keys(NODE_REGISTRY));
      const idMap = new Map<string, string>();
      const nodes = plan.nodes
        .filter((n) => validKinds.has(n.kind))
        .map((n, i) => {
          const kind = n.kind as NodeKind;
          const def = NODE_REGISTRY[kind];
          const realId = `${Date.now().toString(36)}${i}`;
          idMap.set(n.tempId, realId);
          const allowedKeys = new Set(def.params.map((p) => p.key));
          const defaultParams: Record<string, unknown> = {};
          for (const p of def.params) if (p.defaultValue !== undefined) defaultParams[p.key] = p.defaultValue;
          const cleanParams: Record<string, unknown> = { ...defaultParams };
          for (const [k, v] of Object.entries(n.params || {})) {
            if (allowedKeys.has(k)) cleanParams[k] = v;
          }
          return {
            id: realId,
            type: "zalesNode",
            position: { x: 320, y: 100 + i * 170 },
            data: { kind, label: n.label || def.label, params: cleanParams, status: "idle" as const },
          };
        });

      if (nodes.length === 0) {
        return NextResponse.json(
          { error: "The model only proposed node kinds that don't exist in Zales. Try rephrasing." },
          { status: 502 }
        );
      }

      const edges = (plan.edges || [])
        .filter((e) => idMap.has(e.source) && idMap.has(e.target))
        .map((e, i) => ({
          id: `e${i}`,
          source: idMap.get(e.source)!,
          target: idMap.get(e.target)!,
          type: "zalesEdge",
        }));

      return NextResponse.json({ name: plan.name || "AI-generated workflow", nodes, edges });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json({ error: "Failed to generate workflow." }, { status: 500 });
  }
}
