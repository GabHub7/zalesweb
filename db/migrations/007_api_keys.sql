-- Adds API keys for triggering workflows from outside Zales (external
-- integrations, custom apps, etc). Run manually if you prefer:
--   psql "$DATABASE_URL" -f db/migrations/007_api_keys.sql
-- Also auto-applied lazily by src/lib/db/pool.ts on first query, same as
-- the chat tables in 006, so this isn't strictly required.

create table if not exists api_keys (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references users(id) on delete cascade,
  workflow_id text not null references workflows(id) on delete cascade,
  name        text not null default 'API Key',
  key_hash    text not null unique, -- sha256 of the actual key — the plaintext key is shown once at creation and never stored
  key_prefix  text not null,        -- first ~12 chars shown in the UI so the user can tell keys apart without re-revealing them
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_api_keys_user_id on api_keys(user_id, created_at desc);
create index if not exists idx_api_keys_key_hash on api_keys(key_hash);
