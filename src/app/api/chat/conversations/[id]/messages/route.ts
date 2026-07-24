import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversation, listMessages } from "@/lib/db/chat";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const conversation = await getConversation(id, userId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  try {
    const messages = await listMessages(id);
    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "Failed to load messages." }, { status: 500 });
  }
}
