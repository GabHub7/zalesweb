-- Zales schema — run this once against your Neon Postgres database.
-- e.g. psql "$DATABASE_URL" -f db/migrations/001_init.sql

create extension if not exists pgcrypto;

create table if not exists workflows (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  description text,
  nodes       jsonb not null default '[]',
  edges       jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists runs (
  id          text primary key default gen_random_uuid()::text,
  workflow_id text not null references workflows(id) on delete cascade,
  status      text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  log         jsonb not null default '[]'
);

create index if not exists idx_runs_workflow_id on runs(workflow_id);
create index if not exists idx_workflows_updated_at on workflows(updated_at desc);
