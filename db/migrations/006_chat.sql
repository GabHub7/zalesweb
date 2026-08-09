-- Adds persistent chat history for the /chat page (Chat Box trigger +
-- Balas ke Chat node). Run manually if you prefer:
--   psql "$DATABASE_URL" -f db/migrations/006_chat.sql
-- Also auto-applied lazily by src/lib/db/pool.ts on first query, same as
-- the users.settings column in 005, so this isn't strictly required.

create table if not exists chat_conversations (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references users(id) on delete cascade,
  workflow_id text not null references workflows(id) on delete cascade,
  title       text not null default 'Percakapan baru',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_chat_conversations_user_id on chat_conversations(user_id, updated_at desc);

create table if not exists chat_messages (
  id              text primary key default gen_random_uuid()::text,
  conversation_id text not null references chat_conversations(id) on delete cascade,
  role            text not null, -- 'user' | 'assistant'
  text            text not null default '',
  attachments     jsonb not null default '[]', -- [{name, mimeType, sizeBytes}] — file bytes are NOT persisted, only metadata
  created_at      timestamptz not null default now()
);
create index if not exists idx_chat_messages_conversation_id on chat_messages(conversation_id, created_at asc);
