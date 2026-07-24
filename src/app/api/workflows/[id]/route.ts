import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkflow, updateWorkflow, deleteWorkflow } from "@/lib/db/workflows";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const workflow = await getWorkflow(id, userId);
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json({ error: "Failed to load workflow." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const safeFields: { name?: string; description?: string; nodes?: unknown[]; edges?: unknown[] } = {};
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json({ error: "Invalid name." }, { status: 400 });
      }
      safeFields.name = body.name.trim().slice(0, 200);
    }
    if (body.description !== undefined) {
      safeFields.description = typeof body.description === "string" ? body.description.slice(0, 1000) : null;
    }
    if (Array.isArray(body.nodes)) safeFields.nodes = body.nodes.slice(0, 200);
    if (Array.isArray(body.edges)) safeFields.edges = body.edges.slice(0, 300);
    const workflow = await updateWorkflow(id, userId, safeFields as never);
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(workflow);
  } catch {
    return NextResponse.json({ error: "Failed to update workflow." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const existing = await getWorkflow(id, userId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteWorkflow(id, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete workflow." }, { status: 500 });
  }
}
