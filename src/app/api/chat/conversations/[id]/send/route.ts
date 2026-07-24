import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { executeWorkflow } from "@/lib/execution-engine";
import { getUserSettingsDecrypted } from "@/lib/db/users";
import { getWorkflow } from "@/lib/db/workflows";
import { getConversation, addMessage, touchConversation, ChatAttachmentMeta } from "@/lib/db/chat";
import { RunLogEntry } from "@/types/zales";

export const runtime = "nodejs";
// Some nodes (e.g. Generate Presentasi/Gamma) poll an external async job for
// up to a few minutes — default platform timeouts would kill the request
// before that finishes, so this is raised explicitly.
export const maxDuration = 300;

interface IncomingFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: conversationId } = await params;
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  let body: { text?: string; files?: IncomingFile[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const files = Array.isArray(body.files) ? body.files : [];
  if (!text.trim() && files.length === 0) {
    return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  }

  const workflow = await getWorkflow(conversation.workflow_id, userId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow untuk percakapan ini sudah tidak ada — mungkin sudah dihapus." }, { status: 404 });
  }

  const replyNode = workflow.nodes.find((n) => n.data?.kind === "integration.chat_reply");
  if (!replyNode) {
    return NextResponse.json(
      { error: "Workflow ini belum punya node 'Balas ke Chat' — tambahkan di ujung workflow supaya ada balasan yang tampil di sini." },
      { status: 400 }
    );
  }

  // Persist the user's message first — files are stored as metadata only
  // (name/type/size), not the actual bytes, to keep the messages table small.
  const attachmentMeta: ChatAttachmentMeta[] = files.map((f) => ({
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: Math.ceil((f.dataBase64.length * 3) / 4),
  }));
  await addMessage(conversationId, "user", text, attachmentMeta);

  const owner = await getUserSettingsDecrypted(userId);
  const collected: RunLogEntry[] = [];
  let hadError = false;
  let errorMessage = "";

  const outcome = { outputsByLabel: {} as Record<string, unknown> };
  try {
    const result = await executeWorkflow({
      nodes: workflow.nodes,
      edges: workflow.edges,
      onLog: (entry) => collected.push(entry),
      onStatus: () => {},
      triggerData: { text, files },
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
    outcome.outputsByLabel = result.outputsByLabel;
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

  await touchConversation(conversationId);

  if (hadError) {
    return NextResponse.json({ error: `Workflow gagal jalan: ${errorMessage}`, log: collected }, { status: 502 });
  }

  const replyOutput = outcome.outputsByLabel[replyNode.data.label] as { reply?: string } | undefined;
  const replyText = replyOutput?.reply ?? "";

  if (!replyText) {
    return NextResponse.json(
      {
        error:
          "Workflow selesai jalan tapi node 'Balas ke Chat' tidak menghasilkan teks — cek lagi node itu (mungkin gak kepanggil karena ada percabangan, atau field Pesan Balasan kosong).",
        log: collected,
      },
      { status: 502 }
    );
  }

  const savedReply = await addMessage(conversationId, "assistant", replyText);
  return NextResponse.json({ message: savedReply, log: collected });
}
