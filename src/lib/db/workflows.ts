import { query } from "@/lib/db/pool";
import { Edge } from "@xyflow/react";
import { ZalesNode, RunLogEntry } from "@/types/zales";

export interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  nodes: ZalesNode[];
  edges: Edge[];
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunRow {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  log: RunLogEntry[];
}

export async function listWorkflows(userId: string) {
  return query<Omit<WorkflowRow, "nodes" | "edges">>(
    `select id, name, description, user_id, created_at, updated_at
     from workflows where user_id = $1 order by updated_at desc`,
    [userId]
  );
}

/** Full rows (including nodes/edges) for every workflow, across ALL users —
 *  used by background triggers (WhatsApp/Instagram webhooks, the cron
 *  schedule checker) that need to scan every saved workflow for a matching
 *  trigger node, not just one person's. Deliberately NOT scoped by user. */
export async function listWorkflowsFull() {
  return query<WorkflowRow>(`select * from workflows order by updated_at desc`);
}

export async function getWorkflow(id: string, userId: string) {
  const rows = await query<WorkflowRow>(`select * from workflows where id = $1 and user_id = $2`, [id, userId]);
  return rows[0] ?? null;
}

export async function createWorkflow(
  userId: string,
  name: string,
  nodes: ZalesNode[],
  edges: Edge[],
  description?: string
) {
  const rows = await query<WorkflowRow>(
    `insert into workflows (name, description, nodes, edges, user_id)
     values ($1, $2, $3::jsonb, $4::jsonb, $5)
     returning *`,
    [name, description ?? null, JSON.stringify(nodes), JSON.stringify(edges), userId]
  );
  return rows[0];
}

export async function updateWorkflow(
  id: string,
  userId: string,
  fields: { name?: string; description?: string; nodes?: ZalesNode[]; edges?: Edge[] }
) {
  const rows = await query<WorkflowRow>(
    `update workflows set
       name = coalesce($3, name),
       description = coalesce($4, description),
       nodes = coalesce($5::jsonb, nodes),
       edges = coalesce($6::jsonb, edges),
       updated_at = now()
     where id = $1 and user_id = $2
     returning *`,
    [
      id,
      userId,
      fields.name ?? null,
      fields.description ?? null,
      fields.nodes ? JSON.stringify(fields.nodes) : null,
      fields.edges ? JSON.stringify(fields.edges) : null,
    ]
  );
  return rows[0] ?? null;
}

export async function deleteWorkflow(id: string, userId: string) {
  await query(`delete from workflows where id = $1 and user_id = $2`, [id, userId]);
}

export async function recordRun(
  workflowId: string,
  status: string,
  log: RunLogEntry[],
  finishedAt: Date = new Date()
) {
  const rows = await query<RunRow>(
    `insert into runs (workflow_id, status, log, finished_at)
     values ($1, $2, $3::jsonb, $4)
     returning *`,
    [workflowId, status, JSON.stringify(log), finishedAt.toISOString()]
  );
  return rows[0];
}

export async function listRuns(workflowId: string, limit = 20) {
  return query<RunRow>(
    `select * from runs where workflow_id = $1 order by started_at desc limit $2`,
    [workflowId, limit]
  );
}
