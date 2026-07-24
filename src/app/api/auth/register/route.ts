import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "@/lib/db/pool";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();
    const cleanEmail = (email || "").toLowerCase().trim();
    const cleanName = typeof name === "string" ? name.trim().slice(0, 200) : null;

    if (!cleanEmail || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: "Password is too long." }, { status: 400 });
    }

    const existing = await query("select id from users where email = $1", [cleanEmail]);
    if (existing.length > 0) {
      return NextResponse.json({ error: "This email is already registered." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      "insert into users (id, email, name, password_hash) values (gen_random_uuid()::text, $1, $2, $3)",
      [cleanEmail, cleanName, passwordHash]
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
