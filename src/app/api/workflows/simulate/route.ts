import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { executeWorkflow } from "@/lib/execution-engine";
import { getUserSettingsDecrypted } from "@/lib/db/users";
import { RunLogEntry, ZalesNode } from "@/types/zales";
import { Edge } from "@xyflow/react";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const nodes = Array.isArray(body?.nodes) ? (body.nodes as ZalesNode[]) : [];
    const edges = Array.isArray(body?.edges) ? (body.edges as Edge[]) : [];
    const triggerData = body?.triggerData && typeof body.triggerData === "object" ? body.triggerData : {};

    if (nodes.length === 0) {
      return NextResponse.json({ error: "No nodes to run." }, { status: 400 });
    }

    const owner = await getUserSettingsDecrypted(userId);
    const collected: RunLogEntry[] = [];
    let hadError = false;

    try {
      await executeWorkflow({
        nodes,
        edges,
        onLog: (entry) => collected.push(entry),
        onStatus: () => {},
        triggerData,
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

    return NextResponse.json({ ok: !hadError, log: collected });
  } catch {
    return NextResponse.json({ error: "Failed to run simulation." }, { status: 500 });
  }
}
