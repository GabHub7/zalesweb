import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFull, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";
import { RunLogEntry } from "@/types/zales";
import { getUserSettingsDecrypted } from "@/lib/db/users";

export const runtime = "nodejs";
export const maxDuration = 300;

function verifyToken(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!secret) return true; // no secret configured — allow (dev mode)
  const token = req.headers.get("x-webhook-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  return token === secret;
}

function normalizePath(p: string): string {
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

async function handle(req: NextRequest, path: string, method: "GET" | "POST") {
  if (!verifyToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  if (method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = null; // some senders post an empty/non-JSON body — still let it trigger
    }
  }
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const requestedPath = normalizePath(path);

  const workflows = await listWorkflowsFull();
  const matches = workflows.filter((wf) =>
    wf.nodes.some((n) => {
      if (n.data?.kind !== "trigger.webhook") return false;
      const nodePath = normalizePath((n.data.params?.path as string) || "/webhook/my-flow");
      const nodeMethod = ((n.data.params?.method as string) || "POST").toUpperCase();
      return nodePath === requestedPath && nodeMethod === method;
    })
  );

  if (matches.length === 0) {
    return NextResponse.json(
      { error: `No workflow has a Webhook trigger with path "${requestedPath}" and method ${method}.` },
      { status: 404 }
    );
  }

  for (const wf of matches) {
    const collected: RunLogEntry[] = [];
    let hadError = false;
    try {
      const owner = wf.user_id ? await getUserSettingsDecrypted(wf.user_id) : {};
      await executeWorkflow({
        nodes: wf.nodes,
        edges: wf.edges,
        onLog: (entry) => collected.push(entry),
        onStatus: () => {},
        triggerData: { body, query, path: requestedPath, method },
        accountSettings: {
          rapidApiKey: owner.rapidApiKey || "",
          rapidApiHost: owner.rapidApiHost || "",
          whatsappSendUrl: owner.whatsappSendUrl || "",
          metaAccessToken: owner.metaAccessToken || "",
          metaPhoneNumberId: owner.metaPhoneNumberId || "",
        },
      });
    } catch (err) {
      hadError = true;
      collected.push({
        id: "workflow-error",
        nodeId: "workflow",
        nodeLabel: "Workflow",
        status: "error",
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const status = hadError || collected.some((e) => e.status === "error") ? "error" : "success";
    await recordRun(wf.id, status, collected);
  }

  return NextResponse.json({ status: "ok", triggeredWorkflows: matches.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(req, path.join("/"), "POST");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(req, path.join("/"), "GET");
}
