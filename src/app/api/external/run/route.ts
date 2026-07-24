import { NextRequest, NextResponse } from "next/server";
import { executeWorkflow } from "@/lib/execution-engine";
import { getUserSettingsDecrypted } from "@/lib/db/users";
import { getWorkflow, recordRun } from "@/lib/db/workflows";
import { findApiKeyByPlaintext } from "@/lib/db/api-keys";
import { RunLogEntry } from "@/types/zales";

export const runtime = "nodejs";
// Mirrors the other workflow-executing routes — some nodes (e.g. Generate
// Presentasi/Gamma) poll an external async job for up to a few minutes.
export const maxDuration = 300;

/**
 * Public endpoint for triggering a specific workflow from outside Zales —
 * a custom app, another server, Zapier/Make, curl, etc. Auth is via API key
 * (created in Pengaturan Akun > API Keys), not the usual session cookie,
 * since the caller here is a machine, not a logged-in browser.
 *
 * Usage:
 *   curl -X POST https://<domain>/api/external/run \
 *     -H "Authorization: Bearer zsk_..." \
 *     -H "Content-Type: application/json" \
 *     -d '{"text": "halo", "files": []}'
 *
 * The key is scoped to one workflow at creation time — it can only ever
 * trigger that workflow, not any other workflow on the account.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const plaintextKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!plaintextKey) {
    return NextResponse.json(
      { error: "Missing API key — pass it as 'Authorization: Bearer <key>'." },
      { status: 401 }
    );
  }

  const apiKeyRow = await findApiKeyByPlaintext(plaintextKey);
  if (!apiKeyRow) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const workflow = await getWorkflow(apiKeyRow.workflow_id, apiKeyRow.user_id);
  if (!workflow) {
    return NextResponse.json(
      { error: "The workflow this key is scoped to no longer exists — it may have been deleted." },
      { status: 404 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // An empty/absent body is fine — some workflows don't need any input.
  }

  const owner = await getUserSettingsDecrypted(apiKeyRow.user_id);
  const collected: RunLogEntry[] = [];
  let hadError = false;
  let errorMessage = "";
  let outputsByLabel: Record<string, unknown> = {};

  try {
    const result = await executeWorkflow({
      nodes: workflow.nodes,
      edges: workflow.edges,
      onLog: (entry) => collected.push(entry),
      onStatus: () => {},
      triggerData: body,
      accountSettings: {
        rapidApiKey: owner.rapidApiKey || "",
        rapidApiHost: owner.rapidApiHost || "",
        whatsappSendUrl: owner.whatsappSendUrl || "",
        metaAccessToken: owner.metaAccessToken || "",
        metaPhoneNumberId: owner.metaPhoneNumberId || "",
        cloudinaryCloudName: owner.cloudinaryCloudName || "",
        cloudinaryApiKey: owner.cloudinaryApiKey || "",
        cloudinaryApiSecret: owner.cloudinaryApiSecret || "",
        cloudinaryFolder: owner.cloudinaryFolder || "",
        supabaseUrl: owner.supabaseUrl || "",
        supabaseKey: owner.supabaseKey || "",
        supabaseBucket: owner.supabaseBucket || "",
      },
    });
    outputsByLabel = result.outputsByLabel;
  } catch (err) {
    hadError = true;
    errorMessage = err instanceof Error ? err.message : String(err);
    collected.push({
      id: "workflow-error",
      nodeId: "workflow",
      nodeLabel: "Workflow",
      status: "error",
      timestamp: Date.now(),
      error: errorMessage,
    });
  }

  await recordRun(workflow.id, hadError ? "error" : "success", collected as never);

  if (hadError) {
    return NextResponse.json({ error: `Workflow failed: ${errorMessage}`, log: collected }, { status: 502 });
  }

  // If the workflow has a "Balas ke Chat" (or any node named "Reply") node,
  // surface its output directly under `reply` for convenience — otherwise
  // return every node's output so the caller can pick whatever it needs.
  const replyNode = workflow.nodes.find((n) => n.data?.kind === "integration.chat_reply");
  const reply = replyNode ? (outputsByLabel[replyNode.data.label] as { reply?: string } | undefined)?.reply : undefined;

  return NextResponse.json({ reply, outputs: outputsByLabel });
}
