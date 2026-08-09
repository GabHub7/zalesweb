import { CronExpressionParser } from "cron-parser";
import { pool, query } from "@/lib/db/pool";
import { listWorkflowsFull, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";

/** A schedule node is "due" if its cron expression's next fire time from
 *  the last time we checked it (or, first time ever, from 24h ago) is now
 *  in the past. This tolerates being called every few minutes rather than
 *  exactly every 60s — important since on Vercel Hobby, the built-in Cron
 *  can only fire once a day; the recommended setup (see vercel.json /
 *  DEPLOY.md) is to point a free external cron caller (e.g.
 *  cron-job.org) at this endpoint every 1-5 minutes instead. */
async function isDue(cronExpr: string, now: Date, scheduleKey: string): Promise<boolean> {
  try {
    const rows = await query<{ fired_at: string }>(
      "select fired_at from schedule_last_fired where schedule_key = $1",
      [scheduleKey]
    );
    const lastChecked = rows[0] ? new Date(rows[0].fired_at) : new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const interval = CronExpressionParser.parse(cronExpr, { currentDate: lastChecked });
    const next = interval.next().toDate();
    if (next.getTime() > now.getTime()) return false; // not due yet

    await pool.query(
      `insert into schedule_last_fired (schedule_key, fired_at) values ($1, $2)
       on conflict (schedule_key) do update set fired_at = excluded.fired_at`,
      [scheduleKey, now.toISOString()]
    );
    return true;
  } catch (err) {
    console.error(`[zales] Invalid cron expression "${cronExpr}" for schedule ${scheduleKey}:`, err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Checks every saved workflow's Schedule trigger nodes and runs whichever
 *  ones are due. Call this from /api/cron/tick, triggered externally. */
export async function runDueSchedules(): Promise<{ checked: number; ran: number }> {
  const now = new Date();
  const workflows = await listWorkflowsFull();
  let checked = 0;
  let ran = 0;

  for (const wf of workflows) {
    const scheduleNodes = wf.nodes.filter((n) => n.data?.kind === "trigger.schedule");
    for (const node of scheduleNodes) {
      checked++;
      const cronExpr = (node.data.params?.cron as string) || "";
      if (!cronExpr) continue;
      if (!(await isDue(cronExpr, now, `${wf.id}:${node.id}`))) continue;
      ran++;

      const collected: Array<Record<string, unknown>> = [];
      let hadError = false;
      try {
        await executeWorkflow({
          nodes: wf.nodes,
          edges: wf.edges,
          onLog: (entry) => collected.push(entry as unknown as Record<string, unknown>),
          onStatus: () => {},
        });
      } catch (err) {
        hadError = true;
        collected.push({
          id: "workflow-error",
          nodeId: "workflow",
          nodeLabel: "Workflow",
          status: "error",
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
      const status = hadError || collected.some((e) => e.status === "error") ? "error" : "success";
      await recordRun(wf.id, status, collected as never).catch((err) =>
        console.error("[zales] cron: failed to record run:", err)
      );
    }
  }

  return { checked, ran };
}
