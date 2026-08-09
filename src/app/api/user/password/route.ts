import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { query } from "@/lib/db/pool";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await req.json();
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
    }

    const rows = await query<{ password_hash: string | null }>(
      `select password_hash from users where id = $1`,
      [userId]
    );
    const existingHash = rows[0]?.password_hash ?? null;

    // Google-only accounts have no password yet — allow setting one directly.
    if (existingHash) {
      if (typeof currentPassword !== "string" || currentPassword.length === 0) {
        return NextResponse.json({ error: "Current password is required." }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPassword, existingHash);
      if (!valid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(`update users set password_hash = $2 where id = $1`, [userId, newHash]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  }
}
