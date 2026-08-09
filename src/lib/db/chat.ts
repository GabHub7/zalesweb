import { query } from "@/lib/db/pool";

export interface ChatConversationRow {
  id: string;
  user_id: string;
  workflow_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatAttachmentMeta {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  text: string;
  attachments: ChatAttachmentMeta[];
  created_at: string;
}

export async function listConversations(userId: string) {
  return query<ChatConversationRow>(
    `select * from chat_conversations where user_id = $1 order by updated_at desc`,
    [userId]
  );
}

export async function getConversation(id: string, userId: string) {
  const rows = await query<ChatConversationRow>(
    `select * from chat_conversations where id = $1 and user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function createConversation(userId: string, workflowId: string, title?: string) {
  const rows = await query<ChatConversationRow>(
    `insert into chat_conversations (user_id, workflow_id, title)
     values ($1, $2, $3)
     returning *`,
    [userId, workflowId, title || "Percakapan baru"]
  );
  return rows[0];
}

export async function renameConversation(id: string, userId: string, title: string) {
  const rows = await query<ChatConversationRow>(
    `update chat_conversations set title = $3, updated_at = now()
     where id = $1 and user_id = $2 returning *`,
    [id, userId, title]
  );
  return rows[0] ?? null;
}

export async function touchConversation(id: string) {
  await query(`update chat_conversations set updated_at = now() where id = $1`, [id]);
}

export async function deleteConversation(id: string, userId: string) {
  await query(`delete from chat_conversations where id = $1 and user_id = $2`, [id, userId]);
}

export async function listMessages(conversationId: string) {
  return query<ChatMessageRow>(
    `select * from chat_messages where conversation_id = $1 order by created_at asc`,
    [conversationId]
  );
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  text: string,
  attachments: ChatAttachmentMeta[] = []
) {
  const rows = await query<ChatMessageRow>(
    `insert into chat_messages (conversation_id, role, text, attachments)
     values ($1, $2, $3, $4::jsonb)
     returning *`,
    [conversationId, role, text, JSON.stringify(attachments)]
  );
  return rows[0];
}
