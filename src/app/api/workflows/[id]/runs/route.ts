import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkflow, recordRun, listRuns } from "@/lib/db/workflows";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const workflow = await getWorkflow(id, userId);
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const runs = await listRuns(id);
    return NextResponse.json(runs);
  } catch {
    return NextResponse.json({ error: "Failed to load runs." }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const workflow = await getWorkflow(id, userId);
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { status, log } = await req.json();
    const validStatuses = new Set(["success", "error", "running", "queued"]);
    const safeStatus = validStatuses.has(status) ? status : "success";
    const safeLog = Array.isArray(log) ? log.slice(0, 100) : [];

    const run = await recordRun(id, safeStatus, safeLog as never);
    return NextResponse.json(run, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to record run." }, { status: 500 });
  }
}
