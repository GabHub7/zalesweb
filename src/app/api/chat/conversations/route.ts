import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listConversations, createConversation } from "@/lib/db/chat";
import { getWorkflow } from "@/lib/db/workflows";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const conversations = await listConversations(userId);
    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json({ error: "Failed to load conversations." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { workflowId?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  if (!body.workflowId) {
    return NextResponse.json({ error: "workflowId is required." }, { status: 400 });
  }

  const workflow = await getWorkflow(body.workflowId, userId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  }
  const hasChatTrigger = workflow.nodes.some((n) => n.data?.kind === "trigger.chat");
  if (!hasChatTrigger) {
    return NextResponse.json(
      { error: "Workflow ini belum punya node trigger 'Chat Box' — tambahkan dulu di canvas." },
      { status: 400 }
    );
  }

  try {
    const conversation = await createConversation(userId, body.workflowId, body.title);
    return NextResponse.json(conversation, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create conversation." }, { status: 500 });
  }
}
