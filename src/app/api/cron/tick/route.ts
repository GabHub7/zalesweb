import { NextRequest, NextResponse } from "next/server";
import { runDueSchedules } from "@/lib/scheduler";

/** Secures this endpoint so randoms on the internet can't trigger your
 *  workflows on demand. Vercel Cron sends this automatically as a Bearer
 *  token; if you're using an external cron caller instead, add the same
 *  header manually (most services let you set custom headers). */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured — deny in production
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDueSchedules();
  return NextResponse.json({ ok: true, ...result });
}

// Some external cron services only send POST — support both.
export async function POST(req: NextRequest) {
  return GET(req);
}
