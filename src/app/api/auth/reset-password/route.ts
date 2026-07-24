import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db/pool";

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();
    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const rows = await query<{ user_id: string; expires_at: string; used: boolean }>(
      `select user_id, expires_at, used from password_reset_tokens where token = $1`,
      [token]
    );
    const record = rows[0];
    if (!record || record.used || new Date(record.expires_at) < new Date()) {
      return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await query(`update users set password_hash = $2 where id = $1`, [record.user_id, hash]);
    await query(`update password_reset_tokens set used = true where token = $1`, [token]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
