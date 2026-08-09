import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkflow, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";
import { RunLogEntry } from "@/types/zales";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const workflow = await getWorkflow(id, userId);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const collected: RunLogEntry[] = [];
    let hadError = false;

    try {
      await executeWorkflow({
        nodes: workflow.nodes,
        edges: workflow.edges,
        onLog: (entry) => collected.push(entry),
        // No live UI to update on the server; execution order still
        // proceeds correctly since the engine doesn't depend on this
        // callback's return value.
        onStatus: () => {},
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
    const run = await recordRun(id, status, collected);

    return NextResponse.json(run, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
