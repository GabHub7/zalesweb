import { Pool } from "pg";

const globalForDb = global as unknown as { __zalesPool?: Pool };

export const pool =
  globalForDb.__zalesPool ??
  (globalForDb.__zalesPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idle_in_transaction_session_timeout: 30_000,
  }));

let migrated = false;
async function ensureMigration() {
  if (migrated) return;
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id          text primary key default gen_random_uuid()::text,
        user_id     text not null references users(id) on delete cascade,
        workflow_id text not null references workflows(id) on delete cascade,
        title       text not null default 'Percakapan baru',
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now()
      );
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id, updated_at desc);"
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id              text primary key default gen_random_uuid()::text,
        conversation_id text not null references chat_conversations(id) on delete cascade,
        role            text not null,
        text            text not null default '',
        attachments     jsonb not null default '[]',
        created_at      timestamptz not null default now()
      );
    `);
    await pool.query(
      "CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id, created_at asc);"
    );
    await pool.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id          text primary key default gen_random_uuid()::text,
        user_id     text not null references users(id) on delete cascade,
        workflow_id text not null references workflows(id) on delete cascade,
        name        text not null default 'API Key',
        key_hash    text not null unique,
        key_prefix  text not null,
        last_used_at timestamptz,
        created_at  timestamptz not null default now()
      );
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id, created_at desc);");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);");
    migrated = true;
  } catch {
    // Migration may have already been applied or table may not exist yet
    migrated = true;
  }
}

export async function query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
  await ensureMigration();
  const res = await pool.query(text, params);
  return res.rows as T[];
}
