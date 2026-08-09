import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFull, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";
import { createHmac, timingSafeEqual } from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { text?: string };
}
interface MetaEntry {
  id?: string;
  messaging?: MetaMessagingEvent[];
}

function verifyMetaSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!secret) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const entries: MetaEntry[] = (payload as { entry?: MetaEntry[] })?.entry || [];

  for (const entry of entries) {
    for (const event of entry.messaging || []) {
      const from = event.sender?.id;
      const pageId = event.recipient?.id;
      const text = event.message?.text;
      if (!from || !text) continue;
      handleIncomingSocialMessage(from, pageId, text).catch((err) => {
        console.error("[zales] failed to handle incoming social message:", err);
      });
    }
  }

  return NextResponse.json({ status: "ok" });
}

async function handleIncomingSocialMessage(from: string, pageId: string | undefined, text: string) {
  const workflows = await listWorkflowsFull();

  for (const wf of workflows) {
    const triggerNode = wf.nodes.find((n) => n.data?.kind === "trigger.social_message");
    if (!triggerNode) continue;

    const pageFilter = (triggerNode.data.params?.pageId as string) || "";
    const keyword = (triggerNode.data.params?.keyword as string) || "";

    if (pageFilter && pageFilter !== pageId) continue;
    if (keyword && !text.toLowerCase().includes(keyword.toLowerCase())) continue;

    const collected: Array<Record<string, unknown>> = [];
    let hadError = false;
    try {
      await executeWorkflow({
        nodes: wf.nodes,
        edges: wf.edges,
        onLog: (entry) => collected.push(entry as unknown as Record<string, unknown>),
        onStatus: () => {},
        triggerData: { from, pageId, text },
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
    await recordRun(wf.id, status, collected as never);
  }
}
