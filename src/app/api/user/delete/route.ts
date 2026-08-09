import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { query } from "@/lib/db/pool";
import { deleteUserAccount } from "@/lib/db/users";

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { password, confirmation } = await req.json();
    if (confirmation !== "DELETE") {
      return NextResponse.json({ error: 'Type "DELETE" to confirm.' }, { status: 400 });
    }

    const rows = await query<{ password_hash: string | null }>(
      `select password_hash from users where id = $1`,
      [userId]
    );
    const hash = rows[0]?.password_hash ?? null;

    // Only require the password re-check for accounts that actually have one.
    if (hash) {
      if (typeof password !== "string" || password.length === 0) {
        return NextResponse.json({ error: "Password is required." }, { status: 400 });
      }
      const valid = await bcrypt.compare(password, hash);
      if (!valid) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
      }
    }

    await deleteUserAccount(userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
