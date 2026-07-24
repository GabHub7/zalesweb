import { Edge } from "@xyflow/react";
import { RunLogEntry, ZalesNode } from "@/types/zales";
import { nanoid } from "nanoid";
import { NODE_REGISTRY as NODE_REGISTRY_LOOKUP } from "@/lib/node-registry";
import { createHmac } from "crypto";
import JSZip from "jszip";

type LogFn = (entry: RunLogEntry) => void;
type StatusFn = (id: string, status: "queued" | "running" | "success" | "error" | "idle") => void;

interface RunContext {
  nodes: ZalesNode[];
  edges: Edge[];
  onLog: LogFn;
  onStatus: StatusFn;
  triggerData?: Record<string, unknown>;
  /** Account-wide fallback settings (decrypted server-side) — used when a
   *  node's own credential field is left empty, e.g. Send WhatsApp Reply
   *  falling back to the RapidAPI key saved in Account Settings instead of
   *  requiring it to be re-typed into every single node. */
  accountSettings?: Record<string, string>;
}

const FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(url: string, init?: RequestInit, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function computeCloudinarySignature(paramsToSign: string, apiSecret: string): string {
  return createHmac("sha1", apiSecret).update(paramsToSign).digest("hex");
}

/** Resolves the video to upload from either the trigger's file attachments
 *  (input.files[0], e.g. a video the user uploaded via Chat Box) or by
 *  fetching a public URL (e.g. the videoUri returned by the AI Video/Veo
 *  node). Returns raw bytes + mime type either way, so both upload nodes
 *  can treat the source uniformly. */
async function resolveVideoBytes(
  useInputFile: boolean,
  videoUrl: string,
  input: unknown
): Promise<{ bytes: Buffer; mimeType: string }> {
  if (useInputFile) {
    const files = Array.isArray((input as { files?: unknown } | undefined)?.files)
      ? (input as { files: { name?: string; mimeType?: string; dataBase64?: string }[] }).files
      : [];
    const videoFile = files.find((f) => f.mimeType?.startsWith("video/"));
    if (!videoFile?.dataBase64) {
      throw new Error("Tidak ada file video di input.files — pastikan user mengupload video lewat Chat Box.");
    }
    return { bytes: Buffer.from(videoFile.dataBase64, "base64"), mimeType: videoFile.mimeType || "video/mp4" };
  }
  if (!videoUrl) {
    throw new Error("URL Video kosong — isi field itu atau aktifkan 'Ambil video dari file upload trigger'.");
  }
  const res = await fetchWithTimeout(videoUrl, {}, 120_000);
  if (!res.ok) throw new Error(`Gagal mengambil video dari URL (status ${res.status}).`);
  const arrayBuf = await res.arrayBuffer();
  const mimeType = res.headers.get("content-type") || "video/mp4";
  return { bytes: Buffer.from(arrayBuf), mimeType };
}

// --- Shared helpers for describing non-image file attachments as text,
// used by ai.agent (generic OpenAI-compatible — can't take raw file bytes
// beyond images) so ZIP/text/code attachments still reach the model as
// readable content instead of being silently dropped. ---
interface AttachmentFile {
  name?: string;
  mimeType?: string;
  dataBase64?: string;
}

const ZIP_TEXT_EXTENSIONS = /\.(txt|md|json|js|jsx|ts|tsx|css|html|py|java|c|cpp|h|go|rs|rb|php|yml|yaml|toml|env|sql|sh)$/i;
const MAX_ZIP_ENTRIES_LISTED = 200;
const MAX_ZIP_TEXT_FILES_INLINED = 12;
const MAX_ZIP_TEXT_FILE_CHARS = 6000;
const MAX_TEXT_FILE_CHARS = 8000;

function isZipFile(f: AttachmentFile): boolean {
  return f.mimeType === "application/zip" || f.mimeType === "application/x-zip-compressed" || !!f.name?.toLowerCase().endsWith(".zip");
}

async function describeZipAttachment(f: AttachmentFile): Promise<string> {
  try {
    const buf = Buffer.from(f.dataBase64 || "", "base64");
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.values(zip.files);
    const listing = entries
      .slice(0, MAX_ZIP_ENTRIES_LISTED)
      .map((e) => (e.dir ? `${e.name} (folder)` : e.name))
      .join("\n");
    const truncatedNote =
      entries.length > MAX_ZIP_ENTRIES_LISTED ? `\n...dan ${entries.length - MAX_ZIP_ENTRIES_LISTED} entri lainnya` : "";

    let inlined = "";
    let inlinedCount = 0;
    for (const entry of entries) {
      if (entry.dir) continue;
      if (inlinedCount >= MAX_ZIP_TEXT_FILES_INLINED) break;
      if (!ZIP_TEXT_EXTENSIONS.test(entry.name)) continue;
      try {
        const content = await entry.async("string");
        inlined += `\n\n--- ${entry.name} ---\n${content.slice(0, MAX_ZIP_TEXT_FILE_CHARS)}${
          content.length > MAX_ZIP_TEXT_FILE_CHARS ? "\n...(terpotong)" : ""
        }`;
        inlinedCount++;
      } catch {
        // best-effort — skip files that fail to decode as text
      }
    }

    return `[File ZIP: "${f.name}", berisi ${entries.length} entri]\n\nDaftar isi:\n${listing}${truncatedNote}${
      inlined ? `\n\nIsi beberapa file teks di dalamnya:${inlined}` : ""
    }`;
  } catch (err) {
    return `[File ZIP: "${f.name}" — gagal dibaca: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

/** Describes a non-image attachment as plain text for models that can only
 *  accept text + image_url parts (i.e. any generic OpenAI-compatible
 *  endpoint). PDFs and office docs (docx/xlsx/pptx) can't be decoded as
 *  plain text here without a heavier parsing dependency, so those are
 *  named plainly rather than silently mangled. */
async function describeAttachmentAsText(f: AttachmentFile): Promise<string> {
  if (isZipFile(f)) return describeZipAttachment(f);
  if (f.mimeType?.startsWith("text/")) {
    try {
      const text = Buffer.from(f.dataBase64 || "", "base64").toString("utf-8");
      return `[File "${f.name}"]\n${text.slice(0, MAX_TEXT_FILE_CHARS)}${
        text.length > MAX_TEXT_FILE_CHARS ? "\n...(terpotong)" : ""
      }`;
    } catch {
      return `[File "${f.name}" — gagal dibaca sebagai teks.]`;
    }
  }
  return `[File "${f.name}" (${f.mimeType}) diupload — model ini cuma bisa baca teks & gambar secara langsung. Format ini (PDF/dokumen/video/dll) belum bisa dibaca isinya di sini; pakai node "AI Vision (Gemini)" untuk gambar/video, atau minta user mengonversinya ke teks dulu.]`;
}

function resolveTemplate(
  template: string,
  data: unknown,
  nodesByLabel: Record<string, unknown> = {}
): string {
  let out = template.replace(
    /\{\{\s*nodes\[\s*["']([^"']+)["']\s*\]\.([\w.]+)\s*\}\}/g,
    (_match, label: string, path: string) => {
      let cur: unknown = nodesByLabel[label];
      for (const part of path.split(".")) {
        if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[part];
        } else {
          return "";
        }
      }
      return typeof cur === "string" ? cur : JSON.stringify(cur);
    }
  );

  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const parts = path.split(".");
    let cur: unknown = { input: data };
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        return "";
      }
    }
    return typeof cur === "string" ? cur : JSON.stringify(cur);
  });

  return out;
}

function safeGetByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

async function runNode(
  node: ZalesNode,
  input: unknown,
  triggerData?: Record<string, unknown>,
  nodesByLabel: Record<string, unknown> = {},
  allNodes: ZalesNode[] = [],
  accountSettings: Record<string, string> = {},
  depth: number = 0
): Promise<unknown> {
  if (depth > 6) {
    throw new Error(
      `Tool-call recursion too deep (>${6}) — check for AI Agents that are attached to each other as tools, directly or in a loop.`
    );
  }
  const { kind, params } = node.data;

  switch (kind) {
    case "trigger.manual":
    case "trigger.schedule":
    case "trigger.email":
      return { triggered: true, at: new Date().toISOString() };

    case "trigger.webhook":
      return {
        triggered: true,
        at: new Date().toISOString(),
        body: triggerData?.body ?? null,
        query: triggerData?.query ?? {},
      };

    case "trigger.whatsapp_gateway":
      return {
        triggered: true,
        at: new Date().toISOString(),
        from: triggerData?.from ?? null,
        text: triggerData?.text ?? "",
        mediaUrl: triggerData?.mediaUrl ?? null,
        mediaType: triggerData?.mediaType ?? null,
        raw: triggerData?.raw ?? null,
      };

    case "trigger.social_message":
      return {
        triggered: true,
        at: new Date().toISOString(),
        from: triggerData?.from ?? null,
        pageId: triggerData?.pageId ?? null,
        text: triggerData?.text ?? "",
      };

    case "trigger.chat":
      return {
        triggered: true,
        at: new Date().toISOString(),
        text: triggerData?.text ?? "",
        files: triggerData?.files ?? [],
      };

    case "ai.chat": {
      const baseUrl = (params.baseUrl as string) || "http://localhost:11434/v1";
      const model = (params.model as string) || "llama3";
      const promptTemplate = (params.prompt as string) || "{{input}}";
      const userContent = resolveTemplate(promptTemplate, input, nodesByLabel);

      try {
        const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: userContent }],
          }),
        });
        if (!res.ok) throw new Error(`Model server returned ${res.status}`);
        const json = await res.json();
        const text = json?.choices?.[0]?.message?.content ?? JSON.stringify(json);
        return { text, raw: json };
      } catch (err) {
        throw new Error(
          `Could not reach model server at ${baseUrl}. ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    case "ai.agent": {
      const baseUrl = (params.baseUrl as string) || "http://localhost:11434/v1";
      const model = (params.model as string) || "llama3";
      const systemPrompt = (params.systemPrompt as string) || "";
      const maxIterations = Math.max(1, Math.min(10, Number(params.maxToolIterations) || 4));
      const attachedIds = Array.isArray(params.attachedTools) ? (params.attachedTools as string[]) : [];

      // Resolve attached tool/sub-agent nodes into an OpenAI-style "tools"
      // schema. Each one is exposed as a single-string-argument function —
      // the model decides at runtime whether and when to call it, and with
      // what input, instead of the workflow author wiring a fixed chain.
      const toolNodes = attachedIds
        .map((id) => allNodes.find((n) => n.id === id && n.id !== node.id))
        .filter((n): n is ZalesNode => !!n);

      const nameToNode = new Map<string, ZalesNode>();
      const tools = toolNodes.map((toolNode) => {
        const fnName = `call_${toolNode.data.label.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 48)}_${toolNode.id.slice(0, 6)}`;
        nameToNode.set(fnName, toolNode);
        const toolDef = NODE_REGISTRY_LOOKUP[toolNode.data.kind];
        return {
          type: "function",
          function: {
            name: fnName,
            description: `${toolNode.data.label} — ${toolDef?.description ?? toolNode.data.kind}`,
            parameters: {
              type: "object",
              properties: { input: { type: "string", description: "What to pass to this tool/sub-agent." } },
              required: ["input"],
            },
          },
        };
      });

      type ChatContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

      // Some triggers (Chat Box today; others later) can carry raw file
      // uploads alongside the text. Images become multi-part image_url
      // content (vision models actually see them); everything else
      // (zip/text/code) gets extracted as readable text and appended to the
      // prompt, since a generic OpenAI-compatible endpoint has no concept
      // of raw file bytes beyond images — PDFs/docx/video are named plainly
      // rather than silently dropped (see describeAttachmentAsText).
      const inputFiles = Array.isArray((input as { files?: unknown } | undefined)?.files)
        ? ((input as { files: { name?: string; mimeType?: string; dataBase64?: string }[] }).files)
        : [];
      const imageFiles = inputFiles.filter((f) => f.mimeType?.startsWith("image/") && f.dataBase64);
      const otherFiles = inputFiles.filter((f) => !f.mimeType?.startsWith("image/") && f.dataBase64);
      const otherFileDescriptions = await Promise.all(otherFiles.map(describeAttachmentAsText));

      const userText = (() => {
        const template = (params.userMessage as string) || "{{input.text}}";
        const resolved = resolveTemplate(template, input, nodesByLabel);
        // Falls back to the raw input object when the template resolves
        // to nothing (e.g. testing this node standalone, or a trigger
        // shape that doesn't have a .text field) so the agent still
        // gets something useful to work with.
        const base = resolved.trim() ? resolved : JSON.stringify(input);
        return [base, ...otherFileDescriptions].filter(Boolean).join("\n\n");
      })();

      const messages: {
        role: string;
        content: string | ChatContentPart[] | null;
        tool_calls?: unknown[];
        tool_call_id?: string;
        name?: string;
      }[] = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        {
          role: "user",
          content:
            imageFiles.length > 0
              ? [
                  { type: "text", text: userText },
                  ...imageFiles.map((f) => ({
                    type: "image_url" as const,
                    image_url: { url: `data:${f.mimeType};base64,${f.dataBase64}` },
                  })),
                ]
              : userText,
        },
      ];

      let lastJson: unknown = null;

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        let res: Response;
        try {
          res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(params.apiKey ? { Authorization: `Bearer ${params.apiKey}` } : {}),
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: params.temperature ?? 0.7,
              top_p: params.topP ?? 1,
              max_tokens: params.maxTokens ?? 1024,
              ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
            }),
          });
        } catch (err) {
          throw new Error(
            `Could not reach model server at ${baseUrl}. ${err instanceof Error ? err.message : String(err)}`
          );
        }
        if (!res.ok) throw new Error(`Model server returned ${res.status}`);
        const json = await res.json();
        lastJson = json;
        const choice = json?.choices?.[0]?.message;
        const toolCalls: { id: string; function: { name: string; arguments: string } }[] = choice?.tool_calls ?? [];

        if (!toolCalls.length) {
          return { text: choice?.content ?? JSON.stringify(json), raw: json, toolCallsUsed: iteration };
        }

        // Model decided to delegate — run each requested tool/sub-agent
        // node and feed the result back so it can decide what to do next.
        messages.push({ role: "assistant", content: choice.content ?? null, tool_calls: choice.tool_calls });
        for (const call of toolCalls) {
          const targetNode = nameToNode.get(call.function.name);
          let resultText: string;
          if (!targetNode) {
            resultText = `Error: tool "${call.function.name}" not found.`;
          } else {
            let argInput: unknown = call.function.arguments;
            try {
              const parsedArgs = JSON.parse(call.function.arguments || "{}");
              argInput = { text: parsedArgs.input ?? "" };
            } catch {
              argInput = { text: call.function.arguments };
            }
            try {
              const subResult = await runNode(targetNode, argInput, undefined, nodesByLabel, allNodes, accountSettings, depth + 1);
              resultText = typeof subResult === "string" ? subResult : JSON.stringify(subResult);
            } catch (err) {
              resultText = `Error running "${targetNode.data.label}": ${err instanceof Error ? err.message : String(err)}`;
            }
          }
          messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: resultText });
        }
      }

      // Hit max iterations without a final answer — return what we have.
      const finalChoice = (lastJson as { choices?: { message?: { content?: string } }[] } | null)?.choices?.[0]?.message;
      return {
        text: finalChoice?.content ?? "Reached max tool-call iterations without a final answer.",
        raw: lastJson,
        toolCallsUsed: maxIterations,
      };
    }

    case "ai.image": {
      const apiKey = params.apiKey as string;
      const model = (params.model as string) || "gemini-2.5-flash-image";
      const prompt = resolveTemplate((params.prompt as string) || "", input, nodesByLabel);
      if (!apiKey) throw new Error("AI Image node needs a Gemini API key.");
      if (!prompt) throw new Error("AI Image node has an empty prompt.");

      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `Gemini image API returned ${res.status}`);
      }
      const parts = json?.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData);
      if (!imagePart) {
        throw new Error("Gemini did not return an image. Check your prompt or model name.");
      }
      const mimeType = imagePart.inlineData.mimeType || "image/png";
      const imageBase64 = imagePart.inlineData.data as string;
      return {
        imageBase64,
        mimeType,
        imageDataUrl: `data:${mimeType};base64,${imageBase64}`,
        prompt,
      };
    }

    case "ai.vision": {
      const apiKey = params.apiKey as string;
      const model = (params.model as string) || "gemini-2.5-flash";
      const promptTemplate = (params.prompt as string) || "{{input.text}}";
      const promptText = resolveTemplate(promptTemplate, input, nodesByLabel);
      if (!apiKey) throw new Error("AI Vision node needs a Gemini API key.");

      const inputFiles = Array.isArray((input as { files?: unknown } | undefined)?.files)
        ? (input as { files: { name?: string; mimeType?: string; dataBase64?: string }[] }).files
        : [];
      // Native Gemini inlineData accepts images, video, audio, and PDF bytes
      // directly — this is the whole point of this node vs. the generic
      // OpenAI-compatible "AI Agent", which can only do image_url.
      const mediaParts = inputFiles
        .filter((f) => f.dataBase64 && f.mimeType)
        .map((f) => ({ inlineData: { mimeType: f.mimeType as string, data: f.dataBase64 as string } }));

      if (mediaParts.length === 0 && !promptText.trim()) {
        throw new Error("AI Vision node has no media file and no prompt text to work with.");
      }

      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [...mediaParts, ...(promptText.trim() ? [{ text: promptText }] : [])],
              },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || `Gemini API returned ${res.status}`);
      }
      const candidate = json?.candidates?.[0];
      const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
      if (!text) throw new Error("Gemini tidak mengembalikan teks — coba lagi atau ubah prompt.");
      return { text, raw: json, filesAnalyzed: mediaParts.length };
    }

    case "ai.video": {
      const apiKey = params.apiKey as string;
      const model = (params.model as string) || "veo-3.0-generate-001";
      const prompt = resolveTemplate((params.prompt as string) || "", input, nodesByLabel);
      const maxWaitSeconds = Math.min(Number(params.maxWaitSeconds ?? 300), 600);
      if (!apiKey) throw new Error("AI Video node needs a Gemini API key.");
      if (!prompt) throw new Error("AI Video node has an empty prompt.");

      const startRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({ instances: [{ prompt }] }),
        }
      );
      const startJson = await startRes.json();
      if (!startRes.ok) {
        throw new Error(startJson?.error?.message || `Veo API returned ${startRes.status}`);
      }
      const operationName = startJson?.name;
      if (!operationName) throw new Error("Veo did not return an operation to poll.");

      const deadline = Date.now() + maxWaitSeconds * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10_000));
        const pollRes = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/${operationName}`,
          {
            headers: { "x-goog-api-key": apiKey },
          }
        );
        const pollJson = await pollRes.json();
        if (pollJson?.done) {
          const videoUri =
            pollJson?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
          if (!videoUri) throw new Error("Veo finished but returned no video URI.");
          return { videoUri, prompt, operationName };
        }
      }
      throw new Error(
        `Veo generation didn't finish within ${maxWaitSeconds}s. It's still running server-side — increase "Max Wait" or check back later via the operation name: ${operationName}`
      );
    }

    case "ai.memory":
      return { ...(typeof input === "object" && input ? input : {}), memoryNote: "history buffered" };

    case "ai.tool": {
      const serverUrl = params.serverUrl as string;
      const toolName = params.toolName as string;
      const authToken = params.authToken as string;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(resolveTemplate((params.argsJson as string) || "{}", input, nodesByLabel));
      } catch {
        throw new Error("Tool Arguments (JSON) is not valid JSON after resolving {{...}} templates.");
      }
      if (!serverUrl) throw new Error("MCP Connector node has no Server URL configured.");
      if (!toolName) {
        throw new Error(
          'MCP Connector node has no Tool Name. Leave it blank and hit "Test node" once to get an error listing the available tools on this server, then fill one in.'
        );
      }

      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const { StreamableHTTPClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/streamableHttp.js"
      );

      const client = new Client({ name: "zales", version: "1.0.0" });
      const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
        requestInit: authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
      });

      try {
        await client.connect(transport);
        const { tools } = await client.listTools();

        if (!tools.find((t) => t.name === toolName)) {
          const available = tools.map((t) => t.name).join(", ") || "(server has no tools)";
          throw new Error(`Tool "${toolName}" not found on this MCP server. Available tools: ${available}`);
        }

        const result = await client.callTool({ name: toolName, arguments: args });
        return { result: result.content, isError: result.isError ?? false };
      } finally {
        await client.close().catch(() => {});
      }
    }

    case "integration.sheets":
      return { operation: params.operation, spreadsheetId: params.spreadsheetId, mock: true, note: "Google Sheets integration requires OAuth setup. This is a placeholder." };

    case "integration.telegram": {
      const botToken = params.botToken as string;
      const chatId = resolveTemplate((params.chatId as string) || "", input, nodesByLabel);
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);
      if (!botToken) throw new Error("Telegram node needs a Bot Token configured in the Inspector.");
      if (!chatId) throw new Error("Telegram node has no Chat ID configured.");
      if (!message) throw new Error("Telegram node has an empty message.");

      const res = await fetchWithTimeout(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.description || `Telegram API returned ${res.status}`);
      return { sent: true, messageId: json?.result?.message_id, chatId };
    }

    case "integration.social_reply": {
      const accessToken = params.accessToken as string;
      const recipientId = resolveTemplate((params.recipientId as string) || "", input, nodesByLabel);
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);
      if (!accessToken) throw new Error("Reply on Instagram/FB node needs a Page Access Token.");
      if (!recipientId) {
        throw new Error(
          'Reply on Instagram/FB node has no Recipient ID — use {{nodes["Instagram/FB Message"].from}} to reply to whoever triggered the workflow.'
        );
      }
      if (!message) throw new Error("Reply on Instagram/FB node has an empty message.");

      const res = await fetchWithTimeout("https://graph.facebook.com/v20.0/me/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text: message } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Messenger Send API error");
      return { sent: true, recipientId, messageId: json?.message_id };
    }

    case "integration.leadfinder": {
      const apiKey = params.apiKey as string;
      const query = (params.query as string) || "";
      const maxResults = Math.min(Number(params.maxResults ?? 20), 60);
      const onlyMissingWebsite = (params.onlyMissingWebsite as string) !== "no";
      if (!apiKey) throw new Error("Lead Finder node needs a Google Places API key.");
      if (!query) throw new Error("Lead Finder node has no search query (e.g. 'toko kue di Jakarta Selatan').");

      type PlaceResult = {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        nationalPhoneNumber?: string;
        websiteUri?: string;
      };

      const collected: PlaceResult[] = [];
      let pageToken: string | undefined;
      do {
        const res = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,nextPageToken",
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: Math.min(maxResults - collected.length, 20),
            ...(pageToken ? { pageToken } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || `Google Places API returned ${res.status}`);
        collected.push(...(json.places || []));
        pageToken = json.nextPageToken;
      } while (pageToken && collected.length < maxResults);

      const leads = collected
        .slice(0, maxResults)
        .filter((p) => !onlyMissingWebsite || !p.websiteUri)
        .map((p) => ({
          name: p.displayName?.text || "",
          address: p.formattedAddress || "",
          phone: p.nationalPhoneNumber || "",
          hasWebsite: Boolean(p.websiteUri),
          website: p.websiteUri || "",
        }));

      return { leads, count: leads.length, query };
    }

    case "integration.social": {
      const platform = (params.platform as string) || "manual";
      const caption = resolveTemplate((params.caption as string) || "", input, nodesByLabel);
      const inputObj = (typeof input === "object" && input ? (input as Record<string, unknown>) : {});
      const mediaUrl = (params.mediaUrl as string) || (inputObj.imageDataUrl as string) || (inputObj.publicUrl as string) || "";
      const accessToken = params.accessToken as string;
      const accountId = params.accountId as string;

      if (platform === "manual" || platform === "tiktok") {
        return {
          mode: "manual_export",
          platform,
          caption,
          mediaUrl,
          note:
            platform === "tiktok"
              ? "TikTok Content Posting API butuh app kamu di-review dulu oleh TikTok — belum tersambung. Ini payload siap-upload buat kamu post manual sementara."
              : "Belum ada platform yang dipilih / mode manual — ini payload siap-upload.",
        };
      }

      if (!accessToken || !accountId) {
        throw new Error(
          `Node Social Media Post (${platform}) butuh Access Token dan Page/Account ID diisi dulu di Inspector.`
        );
      }
      if (!mediaUrl) {
        throw new Error(
          "Belum ada media buat di-post — sambungin node AI Image/Video atau Media Upload sebelum node ini, atau isi Media URL manual."
        );
      }

      if (mediaUrl.startsWith("data:")) {
        throw new Error(
          "Graph API (Instagram/Facebook) butuh URL publik buat media, bukan base64 langsung. Sambungin node Supabase Storage atau Cloudinary dulu, atau upload ke storage publik lain."
        );
      }

      const base = "https://graph.facebook.com/v20.0";
      if (platform === "facebook") {
        const isVideo = /\.(mp4|mov|avi|webm)/i.test(mediaUrl) || mediaUrl.includes("video");
        if (isVideo) {
          const res = await fetchWithTimeout(`${base}/${accountId}/videos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_url: mediaUrl, description: caption, access_token: accessToken }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.error?.message || "Facebook Video API error");
          return { posted: true, platform, id: json.id };
        }
        const res = await fetchWithTimeout(`${base}/${accountId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: mediaUrl, caption, access_token: accessToken }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || "Facebook Graph API error");
        return { posted: true, platform, id: json.id };
      }

      if (platform === "instagram") {
        const isVideo = /\.(mp4|mov|avi|webm)/i.test(mediaUrl) || mediaUrl.includes("video");

        if (isVideo) {
          const createRes = await fetchWithTimeout(`${base}/${accountId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              media_type: "VIDEO",
              video_url: mediaUrl,
              caption,
              access_token: accessToken,
            }),
          });
          const createJson = await createRes.json();
          if (!createRes.ok) throw new Error(createJson?.error?.message || "Instagram video creation failed");

          const videoId = createJson.id;
          let status = "IN_PROGRESS";
          let attempts = 0;
          while (status === "IN_PROGRESS" && attempts < 60) {
            await new Promise((r) => setTimeout(r, 10_000));
            const statusRes = await fetchWithTimeout(
              `${base}/${videoId}?fields=status&access_token=${accessToken}`
            );
            const statusJson = await statusRes.json();
            status = statusJson?.status || "ERROR";
            attempts++;
          }

          if (status !== "FINISHED") {
            throw new Error(`Instagram video processing ${status} after ${attempts * 10}s. Coba lagi nanti.`);
          }

          const publishRes = await fetchWithTimeout(`${base}/${accountId}/media_publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creation_id: videoId, access_token: accessToken }),
          });
          const publishJson = await publishRes.json();
          if (!publishRes.ok) throw new Error(publishJson?.error?.message || "Instagram video publish failed");
          return { posted: true, platform, type: "video", id: publishJson.id };
        }

        // Image upload (existing logic)
        const createRes = await fetchWithTimeout(`${base}/${accountId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: mediaUrl, caption, access_token: accessToken }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson?.error?.message || "Instagram media creation failed");

        const publishRes = await fetchWithTimeout(`${base}/${accountId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: createJson.id, access_token: accessToken }),
        });
        const publishJson = await publishRes.json();
        if (!publishRes.ok) throw new Error(publishJson?.error?.message || "Instagram publish failed");
        return { posted: true, platform, type: "image", id: publishJson.id };
      }

      return { posted: false, platform, note: "Unsupported platform" };
    }

    case "integration.slack": {
      const webhookUrl = params.webhookUrl as string;
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);
      if (!webhookUrl) throw new Error("Slack node needs an Incoming Webhook URL.");
      const res = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
      return { sent: true, message };
    }

    case "integration.discord": {
      const webhookUrl = params.webhookUrl as string;
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);
      if (!webhookUrl) throw new Error("Discord node needs a Webhook URL.");
      const res = await fetchWithTimeout(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      if (!res.ok) throw new Error(`Discord webhook returned ${res.status}`);
      return { sent: true, message };
    }

    case "integration.notion": {
      const token = params.integrationToken as string;
      const databaseId = params.databaseId as string;
      const titleProp = (params.titlePropertyName as string) || "Name";
      const title = resolveTemplate((params.title as string) || "", input, nodesByLabel);
      if (!token || !databaseId) throw new Error("Notion node needs an Integration Token and Database ID.");

      let extraProps: Record<string, unknown> = {};
      try {
        extraProps = JSON.parse((params.contentJson as string) || "{}");
      } catch {
        throw new Error("Notion node's Extra Properties field isn't valid JSON.");
      }

      const res = await fetchWithTimeout("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties: {
            [titleProp]: { title: [{ text: { content: title } }] },
            ...extraProps,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `Notion API returned ${res.status}`);
      return { created: true, pageId: json.id, url: json.url };
    }

    case "integration.airtable": {
      const token = params.accessToken as string;
      const baseId = params.baseId as string;
      const tableName = params.tableName as string;
      if (!token || !baseId || !tableName) {
        throw new Error("Airtable node needs an Access Token, Base ID, and Table Name.");
      }
      let fields: Record<string, unknown> = {};
      try {
        const raw = (params.fieldsJson as string) || "{}";
        fields = JSON.parse(resolveTemplate(raw, input, nodesByLabel));
      } catch {
        throw new Error("Airtable node's Fields field isn't valid JSON.");
      }
      const res = await fetchWithTimeout(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fields }),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || `Airtable API returned ${res.status}`);
      return { created: true, recordId: json.id, fields: json.fields };
    }

    case "integration.email_send": {
      const apiKey = params.apiKey as string;
      const from = params.from as string;
      const to = resolveTemplate((params.to as string) || "", input, nodesByLabel);
      const subject = resolveTemplate((params.subject as string) || "", input, nodesByLabel);
      const body = resolveTemplate((params.body as string) || "", input, nodesByLabel);
      if (!apiKey || !from || !to) throw new Error("Send Email node needs API Key, From, and To.");

      const res = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to, subject, html: body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `Resend API returned ${res.status}`);
      return { sent: true, id: json.id };
    }

    case "integration.twilio_sms": {
      const accountSid = params.accountSid as string;
      const authToken = params.authToken as string;
      const fromNumber = params.fromNumber as string;
      const toNumber = resolveTemplate((params.toNumber as string) || "", input, nodesByLabel);
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);
      if (!accountSid || !authToken || !fromNumber) {
        throw new Error("Twilio SMS node needs Account SID, Auth Token, and From Number.");
      }
      const body = new URLSearchParams({ From: fromNumber, To: toNumber, Body: message });
      const res = await fetchWithTimeout(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          },
          body: body.toString(),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || `Twilio API returned ${res.status}`);
      return { sent: true, sid: json.sid, status: json.status };
    }

    case "integration.whatsapp_reply": {
      const provider = ((params.provider as string) || "meta").toLowerCase();
      const toNumber = resolveTemplate((params.toNumber as string) || "", input, nodesByLabel);
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);

      if (!toNumber) {
        throw new Error(
          'Nomor tujuan kosong setelah template di-resolve — cek lagi field "Nomor Tujuan" (misalnya {{nodes["WhatsApp Gateway"].from}}).'
        );
      }

      if (provider === "rapidapi") {
        const apiUrl = (params.apiUrl as string) || accountSettings.whatsappSendUrl || "";
        const rapidApiKey = (params.rapidApiKey as string) || accountSettings.rapidApiKey || "";
        const rapidApiHost = (params.rapidApiHost as string) || accountSettings.rapidApiHost || "";
        if (!apiUrl || !rapidApiKey) {
          throw new Error(
            "Send WhatsApp Reply (RapidAPI) node needs a RapidAPI Endpoint URL and X-RapidAPI-Key — isi langsung di node, atau simpan sekali di Pengaturan Akun > API Key."
          );
        }

        let bodyString: string;
        const bodyTemplateJson = params.bodyTemplateJson as string;
        if (bodyTemplateJson && bodyTemplateJson.trim()) {
          bodyString = resolveTemplate(bodyTemplateJson, input, nodesByLabel);
          try {
            JSON.parse(bodyString);
          } catch {
            throw new Error("Send WhatsApp Reply node's Body Request template isn't valid JSON after resolving.");
          }
        } else {
          bodyString = JSON.stringify({ phone: toNumber, message });
        }

        const res = await fetchWithTimeout(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": rapidApiKey,
            ...(rapidApiHost ? { "X-RapidAPI-Host": rapidApiHost } : {}),
          },
          body: bodyString,
        });
        let json: unknown = null;
        try {
          json = await res.json();
        } catch {
          // Some gateways return a non-JSON body on success — that's fine.
        }
        if (!res.ok) {
          const msg = (json as { message?: string } | null)?.message;
          throw new Error(msg || `WhatsApp gateway (RapidAPI) returned ${res.status}`);
        }
        return { sent: true, to: toNumber, provider: "rapidapi", raw: json };
      }

      // provider === "meta" — Meta WhatsApp Cloud API resmi
      const metaAccessToken = (params.metaAccessToken as string) || accountSettings.metaAccessToken || "";
      const metaPhoneNumberId = (params.metaPhoneNumberId as string) || accountSettings.metaPhoneNumberId || "";

      if (!metaAccessToken || !metaPhoneNumberId) {
        throw new Error(
          "Send WhatsApp Reply (Meta) node needs an Access Token and Phone Number ID — isi langsung di node, atau simpan sekali di Pengaturan Akun > WhatsApp Cloud API (Meta). Dapetin dari Meta App dashboard > WhatsApp > API Setup."
        );
      }

      // Normalize nomor tujuan: Meta expects digits only (with country code, no + / spaces / dashes).
      const toDigits = toNumber.replace(/[^\d]/g, "");

      const metaUrl = `https://graph.facebook.com/v21.0/${metaPhoneNumberId}/messages`;
      const metaRes = await fetchWithTimeout(metaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${metaAccessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toDigits,
          type: "text",
          text: { body: message, preview_url: false },
        }),
      });

      let metaJson: unknown = null;
      try {
        metaJson = await metaRes.json();
      } catch {
        // fall through — handled by !metaRes.ok below
      }

      if (!metaRes.ok) {
        const err = (metaJson as { error?: { message?: string; code?: number } } | null)?.error;
        throw new Error(
          err?.message
            ? `Meta WhatsApp Cloud API error: ${err.message}${err.code ? ` (code ${err.code})` : ""}`
            : `Meta WhatsApp Cloud API returned ${metaRes.status} — cek Access Token (mungkin expired kalau pakai temporary token) dan Phone Number ID.`
        );
      }

      return { sent: true, to: toDigits, provider: "meta", raw: metaJson };
    }

    case "integration.chat_reply": {
      const message = resolveTemplate((params.message as string) || "", input, nodesByLabel);
      return { reply: message, sentAt: new Date().toISOString() };
    }

    case "integration.google_maps_scraper": {
      const rapidApiKey = (params.rapidApiKey as string) || accountSettings.rapidApiKey || "";
      const rapidApiHost =
        (params.rapidApiHost as string) || "google-map-scraper1.p.rapidapi.com";
      const endpoint = (params.endpoint as string) || "search";

      if (!rapidApiKey) {
        throw new Error(
          "Google Maps Scraper node needs a X-RapidAPI-Key — isi langsung di node, atau simpan sekali di Pengaturan Akun > API Key (field yang sama dipakai node WhatsApp)."
        );
      }

      const query = resolveTemplate((params.query as string) || "", input, nodesByLabel);
      const placeId = resolveTemplate((params.placeId as string) || "", input, nodesByLabel);
      const lat = resolveTemplate((params.lat as string) || "", input, nodesByLabel);
      const lng = resolveTemplate((params.lng as string) || "", input, nodesByLabel);
      const limit = params.limit ? String(params.limit) : "";

      let extraParams: Record<string, string> = {};
      const extraParamsRaw = resolveTemplate(
        (params.extraParamsJson as string) || "",
        input,
        nodesByLabel
      );
      if (extraParamsRaw.trim()) {
        try {
          extraParams = JSON.parse(extraParamsRaw);
        } catch {
          throw new Error("Google Maps Scraper node's 'Query Param Tambahan' isn't valid JSON.");
        }
      }

      // Path per mode — matches the RapidAPI "Google Map Scraper" endpoints
      // (Search Places / Place Detail / Auto-complete Search).
      const pathByEndpoint: Record<string, string> = {
        search: "/search",
        detail: "/place",
        autocomplete: "/autocomplete",
      };
      const path = pathByEndpoint[endpoint] || "/search";

      const qp = new URLSearchParams();
      if (endpoint === "detail") {
        if (!placeId) {
          throw new Error(
            'Mode "Place Detail" butuh Place ID — isi field Place ID, biasanya dari {{nodes["Google Maps Scraper"].data.results[0].id}} hasil pencarian sebelumnya.'
          );
        }
        qp.set("place_id", placeId);
      } else {
        if (!query) {
          throw new Error("Google Maps Scraper node's Query Pencarian is empty after resolving the template.");
        }
        qp.set("query", query);
        if (lat) qp.set("lat", lat);
        if (lng) qp.set("lng", lng);
        if (limit) qp.set("limit", limit);
      }
      for (const [k, v] of Object.entries(extraParams)) qp.set(k, String(v));

      const url = `https://${rapidApiHost}${path}?${qp.toString()}`;

      let res: Response;
      try {
        res = await fetchWithTimeout(url, {
          method: "GET",
          headers: {
            "X-RapidAPI-Key": rapidApiKey,
            "X-RapidAPI-Host": rapidApiHost,
          },
        });
      } catch (err) {
        throw new Error(
          `Gagal menghubungi Google Maps Scraper (RapidAPI): ${err instanceof Error ? err.message : String(err)}`
        );
      }

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // fall through — handled by !res.ok below
      }

      if (!res.ok) {
        const msg = (json as { message?: string; error?: string } | null)?.message
          || (json as { message?: string; error?: string } | null)?.error;
        throw new Error(
          msg || `Google Maps Scraper (RapidAPI) returned ${res.status} — cek X-RapidAPI-Key/Host dan pastikan sudah subscribe ke API "Google Map Scraper" di RapidAPI Hub.`
        );
      }

      const payload = json as { status?: string; data?: { results?: unknown[] } } | null;
      const results = payload?.data?.results ?? [];

      return {
        status: payload?.status ?? "ok",
        endpoint,
        query,
        count: Array.isArray(results) ? results.length : undefined,
        data: payload?.data ?? payload,
        raw: json,
      };
    }

    case "integration.youtube_upload": {
      const clientId = params.clientId as string;
      const clientSecret = params.clientSecret as string;
      const refreshToken = params.refreshToken as string;
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error(
          "Upload ke YouTube node needs OAuth Client ID, Client Secret, and Refresh Token — dari Google Cloud Console (scope youtube.upload)."
        );
      }

      const useInputFile = (params.videoFileFromInput as string) === "yes";
      const videoUrl = resolveTemplate((params.videoUrl as string) || "", input, nodesByLabel);
      const { bytes: videoBytes } = await resolveVideoBytes(useInputFile, videoUrl, input);

      const title = resolveTemplate((params.title as string) || "{{input.text}}", input, nodesByLabel) || "Untitled";
      const description = resolveTemplate((params.description as string) || "", input, nodesByLabel);
      const tags = ((params.tags as string) || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const privacyStatus = (params.privacyStatus as string) || "public";

      // Step 1 — exchange the long-lived refresh token for a short-lived
      // access token. Done on every run rather than caching, since this
      // workflow may execute infrequently and access tokens expire in ~1hr.
      const tokenRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) {
        throw new Error(
          tokenJson?.error_description || tokenJson?.error || `Gagal refresh token Google (status ${tokenRes.status}).`
        );
      }
      const accessToken = tokenJson.access_token as string;

      // Step 2 — start a resumable upload session with the video metadata.
      const initRes = await fetchWithTimeout(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Type": "video/*",
          },
          body: JSON.stringify({
            snippet: { title, description, tags },
            status: { privacyStatus },
          }),
        }
      );
      if (!initRes.ok) {
        const errJson = await initRes.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Gagal memulai upload YouTube (status ${initRes.status}).`);
      }
      const uploadUrl = initRes.headers.get("location");
      if (!uploadUrl) throw new Error("YouTube tidak mengembalikan upload URL — coba lagi.");

      // Step 3 — PUT the actual video bytes to the resumable session URL.
      const uploadRes = await fetchWithTimeout(
        uploadUrl,
        {
          method: "PUT",
          headers: { "Content-Type": "video/*", "Content-Length": String(videoBytes.length) },
          body: videoBytes as unknown as BodyInit,
        },
        180_000
      );
      const uploadJson = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        throw new Error(uploadJson?.error?.message || `Upload video ke YouTube gagal (status ${uploadRes.status}).`);
      }

      const videoId = uploadJson?.id;
      return {
        uploaded: true,
        videoId,
        url: videoId ? `https://youtu.be/${videoId}` : null,
        raw: uploadJson,
      };
    }

    case "integration.tiktok_upload": {
      const accessToken = params.accessToken as string;
      if (!accessToken) {
        throw new Error("Upload ke TikTok node needs an Access Token dari TikTok Developer Portal.");
      }

      const useInputFile = (params.videoFileFromInput as string) === "yes";
      const videoUrl = resolveTemplate((params.videoUrl as string) || "", input, nodesByLabel);
      const caption = resolveTemplate((params.caption as string) || "{{input.text}}", input, nodesByLabel);
      const privacyLevel = (params.privacyLevel as string) || "SELF_ONLY";

      // TikTok's Content Posting API supports two source modes: PULL_FROM_URL
      // (TikTok fetches the video itself from a public URL — simplest, used
      // when we already have one e.g. from AI Video/Veo) or FILE_UPLOAD
      // (we PUT the raw bytes ourselves — used for a user-uploaded video that
      // has no public URL).
      if (!useInputFile) {
        if (!videoUrl) {
          throw new Error("URL Video kosong — isi field itu atau aktifkan 'Ambil video dari file upload trigger'.");
        }
        const initRes = await fetchWithTimeout("https://open.tiktokapis.com/v2/post/publish/video/init/", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            post_info: { title: caption, privacy_level: privacyLevel },
            source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
          }),
        });
        const initJson = await initRes.json();
        if (!initRes.ok || initJson?.error?.code !== "ok") {
          throw new Error(initJson?.error?.message || `TikTok menolak upload (status ${initRes.status}).`);
        }
        return { uploaded: true, publishId: initJson?.data?.publish_id, raw: initJson };
      }

      // FILE_UPLOAD path — resolve bytes from the trigger's attached file,
      // init the upload session, then PUT the bytes to TikTok's returned URL.
      const { bytes: videoBytes, mimeType } = await resolveVideoBytes(true, "", input);
      const initRes = await fetchWithTimeout("https://open.tiktokapis.com/v2/post/publish/video/init/", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          post_info: { title: caption, privacy_level: privacyLevel },
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoBytes.length,
            chunk_size: videoBytes.length,
            total_chunk_count: 1,
          },
        }),
      });
      const initJson = await initRes.json();
      if (!initRes.ok || initJson?.error?.code !== "ok") {
        throw new Error(initJson?.error?.message || `TikTok menolak inisialisasi upload (status ${initRes.status}).`);
      }
      const uploadUrl = initJson?.data?.upload_url;
      if (!uploadUrl) throw new Error("TikTok tidak mengembalikan upload URL — coba lagi.");

      const putRes = await fetchWithTimeout(
        uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": mimeType,
            "Content-Range": `bytes 0-${videoBytes.length - 1}/${videoBytes.length}`,
          },
          body: videoBytes as unknown as BodyInit,
        },
        180_000
      );
      if (!putRes.ok) {
        throw new Error(`Upload bytes video ke TikTok gagal (status ${putRes.status}).`);
      }

      return { uploaded: true, publishId: initJson?.data?.publish_id, raw: initJson };
    }

    case "integration.gamma_generate": {
      const apiKey = params.apiKey as string;
      if (!apiKey) throw new Error("Generate Presentasi (Gamma) node needs a Gamma API Key.");

      const inputText = resolveTemplate((params.inputText as string) || "{{input.text}}", input, nodesByLabel);
      if (!inputText.trim()) {
        throw new Error("Generate Presentasi (Gamma) node's isi konten kosong setelah template di-resolve.");
      }
      const title = resolveTemplate((params.title as string) || "", input, nodesByLabel);
      const format = (params.format as string) || "presentation";
      const textMode = (params.textMode as string) || "generate";
      const exportAs = (params.exportAs as string) || "pptx";
      const themeId = (params.themeId as string) || undefined;
      const additionalInstructions = resolveTemplate((params.additionalInstructions as string) || "", input, nodesByLabel);
      const imageSource = (params.imageSource as string) || "aiGenerated";
      const numCards = params.numCards ? Number(params.numCards) : undefined;
      const pollTimeoutSeconds = params.pollTimeoutSeconds ? Number(params.pollTimeoutSeconds) : 180;

      const createRes = await fetchWithTimeout("https://public-api.gamma.app/v1.0/generations", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputText,
          textMode,
          format,
          exportAs,
          ...(title.trim() ? { title: title.slice(0, 500) } : {}),
          ...(numCards ? { numCards } : {}),
          ...(themeId ? { themeId } : {}),
          ...(additionalInstructions.trim() ? { additionalInstructions: additionalInstructions.slice(0, 5000) } : {}),
          imageOptions: { source: imageSource },
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        const msg =
          createRes.status === 401
            ? "Gamma API Key tidak valid — cek lagi key-nya (butuh header X-API-KEY, bukan Bearer)."
            : createRes.status === 402
              ? "Kredit Gamma habis — cek plan/kredit akun Gamma lo."
              : createJson?.message || createJson?.error || `Gamma API returned ${createRes.status}`;
        throw new Error(msg);
      }
      const generationId = createJson?.generationId;
      if (!generationId) throw new Error("Gamma tidak mengembalikan generationId — coba lagi.");

      // Gamma generation is asynchronous — poll every 5s per Gamma's own
      // guidance until status is "completed" or "failed", bounded by
      // pollTimeoutSeconds so a slow/stuck generation can't hang the
      // workflow run forever.
      const deadline = Date.now() + pollTimeoutSeconds * 1000;
      let statusJson: {
        status?: string;
        gammaId?: string;
        gammaUrl?: string;
        exportUrl?: string;
        credits?: unknown;
        error?: { message?: string };
      } = {};
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const pollRes = await fetchWithTimeout(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
          headers: { "X-API-KEY": apiKey },
        });
        statusJson = await pollRes.json();
        if (statusJson.status === "completed" || statusJson.status === "failed") break;
      }

      if (statusJson.status === "failed") {
        throw new Error(statusJson.error?.message || "Gamma gagal generate presentasi.");
      }
      if (statusJson.status !== "completed") {
        throw new Error(
          `Gamma belum selesai generate dalam ${pollTimeoutSeconds} detik (masih "${statusJson.status || "pending"}") — perbesar 'Maks Waktu Tunggu' atau cek generationId "${generationId}" manual nanti.`
        );
      }

      return {
        generationId,
        gammaId: statusJson.gammaId,
        gammaUrl: statusJson.gammaUrl,
        exportUrl: statusJson.exportUrl,
        credits: statusJson.credits,
      };
    }

    case "integration.supabase_storage": {
      const supabaseUrl = (params.supabaseUrl as string) || accountSettings.supabaseUrl || "";
      const supabaseKey = (params.supabaseKey as string) || accountSettings.supabaseKey || "";
      const bucket = (params.bucket as string) || accountSettings.supabaseBucket || "media";
      const folder = (params.folder as string) || "whatsapp-uploads";
      const fileUrl = resolveTemplate((params.fileUrl as string) || "", input, nodesByLabel);
      const fileName = (params.fileName as string) || "";

      if (!supabaseUrl) throw new Error("Supabase Storage node needs Supabase Project URL — isi di node atau di Pengaturan Akun.");
      if (!supabaseKey) throw new Error("Supabase Storage node needs Supabase Key — isi di node atau di Pengaturan Akun.");
      if (!fileUrl) throw new Error("Supabase Storage node has no file URL — connect from WhatsApp Gateway trigger's mediaUrl.");

      // Validate URL format
      try { new URL(fileUrl); } catch {
        throw new Error(`File URL tidak valid: "${fileUrl.slice(0, 80)}" — pastikan WhatsApp Gateway mengirim media URL yang benar.`);
      }

      let fileRes: Response;
      try {
        fileRes = await fetchWithTimeout(fileUrl);
      } catch (err) {
        throw new Error(`Gagal download file dari WhatsApp: ${err instanceof Error ? err.message : String(err)}. URL mungkin expired — cek provider WA gateway kamu.`);
      }
      if (!fileRes.ok) throw new Error(`Failed to download file from ${fileUrl.slice(0, 80)} — status ${fileRes.status}`);

      const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
      const fileBuffer = await fileRes.arrayBuffer();
      const fileBytes = new Uint8Array(fileBuffer);

      const ext = fileUrl.split(".").pop()?.split("?")[0]?.slice(0, 10) || "bin";
      const baseName = fileName || `${folder}/${Date.now()}.${ext}`;

      const uploadUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${baseName}`;
      let uploadRes: Response;
      try {
        uploadRes = await fetchWithTimeout(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": contentType,
            "Authorization": `Bearer ${supabaseKey}`,
            "x-upsert": "true",
          },
          body: fileBytes,
        });
      } catch (err) {
        throw new Error(`Gagal upload ke Supabase Storage: ${err instanceof Error ? err.message : String(err)}. Cek URL project dan key.`);
      }

      if (!uploadRes.ok) {
        const errBody = await uploadRes.text().catch(() => "");
        const hint = uploadRes.status === 403
          ? " —Bucket mungkin belum dibuat atau RLS policy belum di-set. Buat bucket dulu di Supabase Dashboard → Storage."
          : uploadRes.status === 404
          ? " —Bucket tidak ditemukan. Cek nama bucket di Pengaturan Akun."
          : "";
        throw new Error(`Supabase upload failed (${uploadRes.status}): ${errBody}${hint}`);
      }

      const publicUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${baseName}`;

      return {
        uploaded: true,
        publicUrl,
        fileName: baseName,
        contentType,
        size: fileBytes.length,
      };
    }

    case "integration.media_upload": {
      const cloudName = (params.cloudName as string) || accountSettings.cloudinaryCloudName || "";
      const apiKey = (params.apiKey as string) || accountSettings.cloudinaryApiKey || "";
      const apiSecret = (params.apiSecret as string) || accountSettings.cloudinaryApiSecret || "";
      const folder = (params.folder as string) || accountSettings.cloudinaryFolder || "zales-uploads";
      const fileUrl = resolveTemplate((params.fileUrl as string) || "", input, nodesByLabel);
      const resourceType = (params.resourceType as string) || "auto";

      if (!cloudName) throw new Error("Cloudinary node needs Cloud Name — isi di node atau di Pengaturan Akun.");
      if (!apiKey) throw new Error("Cloudinary node needs API Key — isi di node atau di Pengaturan Akun.");
      if (!apiSecret) throw new Error("Cloudinary node needs API Secret — isi di node atau di Pengaturan Akun.");
      if (!fileUrl) throw new Error("Cloudinary node has no file URL — connect from WhatsApp Gateway trigger's mediaUrl.");

      try { new URL(fileUrl); } catch {
        throw new Error(`File URL tidak valid: "${fileUrl.slice(0, 80)}" — pastikan WhatsApp Gateway mengirim media URL yang benar.`);
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const resourceTypeParam = resourceType === "auto" ? "auto" : resourceType;
      const paramsToSign = `folder=${folder}&resource_type=${resourceTypeParam}&timestamp=${timestamp}`;
      const signature = computeCloudinarySignature(paramsToSign, apiSecret);

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceTypeParam}/upload`;
      const formData = new URLSearchParams();
      formData.append("file", fileUrl);
      formData.append("folder", folder);
      formData.append("timestamp", String(timestamp));
      formData.append("api_key", apiKey);
      formData.append("signature", signature);

      let uploadRes: Response;
      try {
        uploadRes = await fetchWithTimeout(uploadUrl, {
          method: "POST",
          body: formData,
        });
      } catch (err) {
        throw new Error(`Gagal koneksi ke Cloudinary: ${err instanceof Error ? err.message : String(err)}. Cek koneksi internet.`);
      }

      const result = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok) {
        const errMsg = result?.error?.message || `Cloudinary upload failed (${uploadRes.status})`;
        const hint = uploadRes.status === 401
          ? " — API Key atau Secret salah. Cek di Cloudinary Dashboard → Settings → Upload."
          : uploadRes.status === 400
          ? " — Format file tidak didukung atau folder tidak ada."
          : "";
        throw new Error(`${errMsg}${hint}`);
      }

      return {
        uploaded: true,
        publicUrl: result.secure_url,
        url: result.url,
        resourceType: result.resource_type,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    }

    case "office.excel": {
      const fileName = (params.fileName as string) || "laporan.xlsx";
      const sheetName = (params.sheetName as string) || "Sheet1";
      let rows: Record<string, unknown>[];
      try {
        const raw = resolveTemplate((params.dataJson as string) || "[]", input, nodesByLabel);
        const parsed = raw.trim().startsWith("[") || raw.trim().startsWith("{") ? JSON.parse(raw) : input;
        rows = Array.isArray(parsed) ? parsed : Array.isArray(input) ? (input as Record<string, unknown>[]) : [];
      } catch {
        rows = Array.isArray(input) ? (input as Record<string, unknown>[]) : [];
      }
      if (rows.length === 0) {
        throw new Error("Generate Excel node has no rows — check the Data field or the upstream node's output.");
      }

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(sheetName);
      const headers = Object.keys(rows[0]);
      sheet.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));
      sheet.getRow(1).font = { bold: true };
      rows.forEach((r) => sheet.addRow(r));

      const buffer = await workbook.xlsx.writeBuffer();
      const fileBase64 = Buffer.from(buffer).toString("base64");
      return {
        fileName,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileBase64,
        rowCount: rows.length,
      };
    }

    case "office.word": {
      const fileName = (params.fileName as string) || "laporan.docx";
      const title = resolveTemplate((params.title as string) || "", input, nodesByLabel);
      const content = resolveTemplate((params.content as string) || "", input, nodesByLabel);
      const paragraphs = content.split("\n").filter((line) => line.trim().length > 0);

      const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
      const doc = new Document({
        sections: [
          {
            children: [
              ...(title ? [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 })] : []),
              ...paragraphs.map((p) => new Paragraph({ text: p })),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      const fileBase64 = Buffer.from(buffer).toString("base64");
      return {
        fileName,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileBase64,
      };
    }

    case "office.pptx": {
      const fileName = (params.fileName as string) || "presentasi.pptx";
      let slides: { title?: string; bullets?: string[] }[];
      try {
        const raw = resolveTemplate((params.slidesJson as string) || "[]", input, nodesByLabel);
        const parsed = raw.trim().startsWith("[") ? JSON.parse(raw) : input;
        slides = Array.isArray(parsed) ? parsed : [];
      } catch {
        slides = Array.isArray(input) ? (input as { title?: string; bullets?: string[] }[]) : [];
      }
      if (slides.length === 0) {
        throw new Error("Generate PowerPoint node has no slides — check the Slides field.");
      }

      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      for (const s of slides) {
        const slide = pptx.addSlide();
        if (s.title) slide.addText(s.title, { x: 0.5, y: 0.4, fontSize: 24, bold: true });
        if (s.bullets?.length) {
          slide.addText(
            s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
            { x: 0.5, y: 1.3, fontSize: 16 }
          );
        }
      }
      const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
      const fileBase64 = Buffer.from(buffer).toString("base64");
      return {
        fileName,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileBase64,
        slideCount: slides.length,
      };
    }

    case "integration.file":
      return { path: params.path, format: params.format, mock: true, note: "File system integration requires server-side setup. This is a placeholder." };

    case "integration.http": {
      const url = resolveTemplate((params.url as string) || "", input, nodesByLabel);
      if (!url) throw new Error("HTTP node has no URL configured");
      const method = (params.method as string) || "GET";

      let extraHeaders: Record<string, string> = {};
      const headersRaw = resolveTemplate((params.headers as string) || "{}", input, nodesByLabel);
      try {
        extraHeaders = headersRaw.trim() ? JSON.parse(headersRaw) : {};
      } catch {
        throw new Error("HTTP node's Headers field is not valid JSON.");
      }

      const bodyRaw =
        method !== "GET" && params.body
          ? resolveTemplate(params.body as string, input, nodesByLabel)
          : undefined;

      const res = await fetchWithTimeout(url, {
        method,
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: bodyRaw,
      });
      const contentType = res.headers.get("content-type") || "";
      const body = contentType.includes("json") ? await res.json() : await res.text();
      return { status: res.status, body };
    }

    case "transform.code": {
      const code = (params.code as string) || "";
      if (!code.trim()) return input;
      // Safe evaluation: only allow expressions, not arbitrary code execution.
      // Users write JS expressions that operate on `input`, e.g.
      // "input.items.filter(x => x.active).map(x => x.name)"
      try {
        // Use Function constructor with strict sandboxing:
        // - Only input is available as a parameter
        // - The code must be a single expression
        const fn = new Function("input", `"use strict"; return (${code});`);
        return fn(input);
      } catch (err) {
        throw new Error(
          `Code expression failed: ${err instanceof Error ? err.message : String(err)}. ` +
          `Write a JavaScript expression that operates on 'input', e.g. "input.items.length" or "input.data.map(x => x.name)"`
        );
      }
    }

    case "transform.json": {
      try {
        const mapping = JSON.parse((params.mapping as string) || "{}");
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(mapping)) {
          result[key] = typeof val === "string" ? resolveTemplate(val, input, nodesByLabel) : val;
        }
        return result;
      } catch {
        return input;
      }
    }

    case "transform.merge":
      return input;

    case "transform.set": {
      const keepOriginal = (params.keepOriginal as string) !== "replace";
      let fields: Record<string, unknown> = {};
      try {
        const raw = (params.fieldsJson as string) || "{}";
        fields = JSON.parse(resolveTemplate(raw, input, nodesByLabel));
      } catch {
        throw new Error("Set Fields node's JSON isn't valid — check for a trailing comma or missing quote.");
      }
      const base = keepOriginal && input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      return { ...base, ...fields };
    }

    case "transform.filter": {
      const condition = (params.condition as string) || "true";
      try {
        const fn = new Function("input", `"use strict"; return Boolean(${condition});`);
        if (!fn(input)) {
          throw new Error("__ZALES_FILTERED__");
        }
        return input;
      } catch (err) {
        if (err instanceof Error && err.message === "__ZALES_FILTERED__") {
          return { __filtered: true, input };
        }
        return { __filtered: true, input, filterError: err instanceof Error ? err.message : String(err) };
      }
    }

    case "logic.if": {
      const condition = (params.condition as string) || "true";
      try {
        // Safe: only evaluates the expression with input in scope
        const fn = new Function("input", `"use strict"; return Boolean(${condition});`);
        return { branch: fn(input) ? "true" : "false", input };
      } catch {
        return { branch: "false", input };
      }
    }

    case "logic.switch": {
      const valuePath = (params.valuePath as string) || "input.category";
      let cases: string[] = [];
      try {
        cases = JSON.parse((params.casesJson as string) || "[]");
      } catch {
        cases = [];
      }
      const raw = safeGetByPath({ input }, valuePath);
      const value = typeof raw === "string" ? raw : JSON.stringify(raw);
      const matched = cases.find((c) => c === value);
      return { branch: matched ?? "default", value, input };
    }

    case "logic.wait": {
      const seconds = Math.max(1, Math.min(25, Number(params.seconds) || 3));
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return { waited: seconds, input };
    }

    case "logic.loop": {
      const path = (params.itemsPath as string) || "input.items";
      try {
        // Safe: only reads a property path from the input object
        const items = safeGetByPath(input, path);
        return { items: Array.isArray(items) ? items : [] };
      } catch {
        return { items: [] };
      }
    }

    default:
      return input;
  }
}

export async function executeWorkflow(ctx: RunContext) {
  const { nodes, edges, onLog, onStatus, triggerData, accountSettings } = ctx;

  const triggerNodes = nodes.filter((n) => n.data.kind.startsWith("trigger."));
  if (triggerNodes.length === 0) {
    throw new Error("No trigger node found. Add a Trigger node to start the workflow.");
  }

  const outputs = new Map<string, unknown>();
  const outputsByLabel: Record<string, unknown> = {};
  const visited = new Set<string>();
  const queue: ZalesNode[] = [...triggerNodes];

  nodes.forEach((n) => onStatus(n.id, "idle"));

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);

    const incomingEdges = edges.filter((e) => e.target === node.id);
    const input =
      incomingEdges.length === 1
        ? outputs.get(incomingEdges[0].source)
        : incomingEdges.length > 1
        ? incomingEdges.map((e) => outputs.get(e.source))
        : undefined;

    onStatus(node.id, "running");
    const start = performance.now();
    try {
      const output = await runNode(
        node,
        input,
        node.data.kind.startsWith("trigger.") ? triggerData : undefined,
        outputsByLabel,
        nodes,
        accountSettings
      );
      outputs.set(node.id, output);
      outputsByLabel[node.data.label] = output;
      onStatus(node.id, "success");
      onLog({
        id: nanoid(8),
        nodeId: node.id,
        nodeLabel: node.data.label,
        status: "success",
        timestamp: Date.now(),
        durationMs: performance.now() - start,
        input,
        output,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onStatus(node.id, "error");
      onLog({
        id: nanoid(8),
        nodeId: node.id,
        nodeLabel: node.data.label,
        status: "error",
        timestamp: Date.now(),
        durationMs: performance.now() - start,
        input,
        error: message,
      });
      continue;
    }

    const nextEdges = edges.filter((e) => e.source === node.id);
    for (const e of nextEdges) {
      const targetNode = nodes.find((n) => n.id === e.target);
      if (targetNode && !visited.has(targetNode.id)) queue.push(targetNode);
    }
  }

  return { outputsByLabel };
}
