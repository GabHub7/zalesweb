-- Fixes a production bug: users.ts / api/user/settings read+write a
-- `settings` column that no prior migration ever created, so Account
-- Settings (API keys) would 500 in production. Also adds profile /
-- security fields needed for the account settings & danger zone.

alter table users add column if not exists settings jsonb not null default '{}'::jsonb;
alter table users add column if not exists timezone text not null default 'Asia/Jakarta';
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists login_count integer not null default 0;

create table if not exists login_events (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_login_events_user_id_created_at on login_events(user_id, created_at desc);

create table if not exists password_reset_tokens (
  token      text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_reset_tokens_user_id on password_reset_tokens(user_id);
