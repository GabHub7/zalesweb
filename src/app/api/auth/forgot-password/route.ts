import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/lib/db/pool";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function sendResetEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    // No email provider configured — log so local/dev flows still work.
    console.warn(`[forgot-password] RESEND_API_KEY not set. Reset link for ${to}: ${resetUrl}`);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your Zales password",
      html: `<p>Click the link below to reset your Zales password. This link expires in 30 minutes.</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>
             <p>If you didn't request this, you can ignore this email.</p>`,
    }),
  }).catch((err) => console.error("[forgot-password] Resend send failed:", err));
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    const normalized = email.toLowerCase().trim();

    const rows = await query<{ id: string }>(`select id from users where email = $1`, [normalized]);
    const user = rows[0];

    // Always return the same response whether or not the account exists,
    // so this endpoint can't be used to enumerate registered emails.
    const genericResponse = NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });

    if (!user) return genericResponse;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    await query(
      `insert into password_reset_tokens (token, user_id, expires_at) values ($1, $2, $3)`,
      [token, user.id, expiresAt.toISOString()]
    );

    const origin = req.headers.get("origin") || new URL(req.url).origin;
    const resetUrl = `${origin}/reset-password?token=${token}`;
    await sendResetEmail(normalized, resetUrl);

    return genericResponse;
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
