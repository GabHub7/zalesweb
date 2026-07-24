import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteConversation, renameConversation } from "@/lib/db/chat";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteConversation(id, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete conversation." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }
  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }

  try {
    const updated = await renameConversation(id, userId, body.title.slice(0, 200));
    if (!updated) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to rename conversation." }, { status: 500 });
  }
}
