create table if not exists users (
  id            text primary key default gen_random_uuid()::text,
  email         text unique not null,
  name          text,
  password_hash text,              -- null for Google-only accounts
  image         text,
  created_at    timestamptz not null default now()
);

-- Existing workflows table predates login — add an owner column. Nullable
-- so old rows (created before auth existed) don't break; new workflows
-- always get a real user_id from here on.
alter table workflows add column if not exists user_id text references users(id) on delete cascade;
create index if not exists idx_workflows_user_id on workflows(user_id);
