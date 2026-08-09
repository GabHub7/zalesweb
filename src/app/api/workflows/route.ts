import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listWorkflows, createWorkflow } from "@/lib/db/workflows";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const workflows = await listWorkflows(userId);
    return NextResponse.json(workflows);
  } catch {
    return NextResponse.json({ error: "Failed to load workflows." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, nodes, edges, description } = await req.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ error: "name is too long" }, { status: 400 });
    }
    const safeNodes = Array.isArray(nodes) ? nodes.slice(0, 200) : [];
    const safeEdges = Array.isArray(edges) ? edges.slice(0, 300) : [];
    const safeDesc = typeof description === "string" ? description.slice(0, 1000) : undefined;
    const workflow = await createWorkflow(userId, name.trim(), safeNodes, safeEdges, safeDesc);
    return NextResponse.json(workflow, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create workflow." }, { status: 500 });
  }
}
