import crypto from "crypto";
import { query } from "@/lib/db/pool";

export interface ApiKeyRow {
  id: string;
  user_id: string;
  workflow_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

const KEY_PREFIX = "zsk_"; // "Zales secret key" — mirrors the sk_/pk_ convention used by Stripe etc.

/** Generates a new plaintext API key. Only ever returned to the caller once,
 *  at creation time — never stored or logged in plaintext anywhere. */
function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${crypto.randomBytes(24).toString("hex")}`;
}

/** One-way hash used to verify a presented key against storage. Unlike the
 *  reversible encryption used for third-party API keys elsewhere in this
 *  app, this key never needs to be read back — Zales only ever needs to
 *  confirm "does this hash match," so a plain SHA-256 digest is enough and
 *  avoids keeping anything reversible in the database. */
function hashKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export async function listApiKeys(userId: string) {
  return query<Omit<ApiKeyRow, "key_hash">>(
    `select id, user_id, workflow_id, name, key_prefix, last_used_at, created_at
     from api_keys where user_id = $1 order by created_at desc`,
    [userId]
  );
}

/** Creates a new key for the given workflow and returns the row PLUS the
 *  one-time plaintext key — the only moment it's ever visible. */
export async function createApiKey(userId: string, workflowId: string, name?: string) {
  const plaintext = generatePlaintextKey();
  const keyHash = hashKey(plaintext);
  const keyPrefix = plaintext.slice(0, 12);

  const rows = await query<Omit<ApiKeyRow, "key_hash">>(
    `insert into api_keys (user_id, workflow_id, name, key_hash, key_prefix)
     values ($1, $2, $3, $4, $5)
     returning id, user_id, workflow_id, name, key_prefix, last_used_at, created_at`,
    [userId, workflowId, name || "API Key", keyHash, keyPrefix]
  );
  return { row: rows[0], plaintextKey: plaintext };
}

export async function deleteApiKey(id: string, userId: string) {
  await query(`delete from api_keys where id = $1 and user_id = $2`, [id, userId]);
}

/** Looks up an API key by its plaintext value (as presented in an
 *  Authorization header) and returns the owning row, or null if it doesn't
 *  match anything. Also stamps last_used_at for visibility in the UI. */
export async function findApiKeyByPlaintext(plaintext: string): Promise<ApiKeyRow | null> {
  if (!plaintext.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashKey(plaintext);
  const rows = await query<ApiKeyRow>(`select * from api_keys where key_hash = $1`, [keyHash]);
  const row = rows[0] ?? null;
  if (row) {
    // Best-effort — don't fail the request if this write hiccups.
    query(`update api_keys set last_used_at = now() where id = $1`, [row.id]).catch(() => {});
  }
  return row;
}
