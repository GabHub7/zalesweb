-- Tracks when each Schedule trigger node last fired. Needed because on
-- serverless (Vercel), nothing survives between invocations — this table
-- is what replaces the old in-memory "already fired this minute" map.
create table if not exists schedule_last_fired (
  schedule_key text primary key,  -- "<workflow_id>:<node_id>"
  fired_at     timestamptz not null
);
