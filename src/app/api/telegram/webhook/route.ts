import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSettingsDecrypted } from "@/lib/db/users";
import { maskSecret } from "@/lib/crypto";

/**
 * Registers and checks the status of the caller's Telegram webhook,
 * so they don't have to hand-paste a setWebhook URL into their browser
 * (README §5.1/§5.2 — "Webhook Registration & Validation").
 *
 * GET  -> calls Telegram's getWebhookInfo and returns a token-masked summary.
 * POST -> calls Telegram's setWebhook pointing at this deployment's
 *         /api/webhooks/telegram/<token> callback.
 *
 * The raw Bot Token never leaves the server: it's decrypted here just long
 * enough to call the Telegram API, and any URL/error text that might embed
 * it is masked before being sent back to the browser.
 */

function expectedCallbackUrl(req: NextRequest, token: string): string {
  const origin = req.nextUrl.origin;
  return `${origin}/api/webhooks/telegram/${token}`;
}

/** Replaces any raw bot token that shows up inside a string (e.g. inside
 *  Telegram's own `url` or `last_error_message` fields) with a masked form,
 *  so a token never round-trips to the client even indirectly. */
function redactToken(text: string, token: string): string {
  if (!token) return text;
  return text.split(token).join(maskSecret(token));
}

async function getBotToken(): Promise<{ userId: string; token: string } | { error: NextResponse }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const settings = await getUserSettingsDecrypted(userId);
  const token = settings.telegramBotToken || "";
  if (!token) {
    return {
      error: NextResponse.json(
        {
          error: "TOKEN_MISSING",
          message: "Bot Token Telegram belum diisi. Isi dulu di Pengaturan Akun > API Keys.",
        },
        { status: 400 }
      ),
    };
  }
  return { userId, token };
}

export async function GET(req: NextRequest) {
  const result = await getBotToken();
  if ("error" in result) return result.error;
  const { token } = result;

  let info: {
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  } = {};
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const json = await res.json();
    if (!json.ok) {
      return NextResponse.json(
        { error: "INVALID_TOKEN", message: "Bot Token Telegram tidak valid. Periksa token dari @BotFather." },
        { status: 400 }
      );
    }
    info = json.result || {};
  } catch {
    return NextResponse.json(
      { error: "FETCH_FAILED", message: "Gagal menghubungi Telegram API. Coba lagi sebentar lagi." },
      { status: 502 }
    );
  }

  const configuredUrl = info.url || "";
  const expected = expectedCallbackUrl(req, token);
  // Compare on the un-masked value server-side, then mask before returning.
  const matches = !!configuredUrl && configuredUrl === expected;

  return NextResponse.json({
    configured: !!configuredUrl,
    matches,
    url: configuredUrl ? redactToken(configuredUrl, token) : null,
    pendingUpdateCount: info.pending_update_count ?? 0,
    lastErrorDate: info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : null,
    lastErrorMessage: info.last_error_message ? redactToken(info.last_error_message, token) : null,
  });
}

export async function POST(req: NextRequest) {
  const result = await getBotToken();
  if ("error" in result) return result.error;
  const { token } = result;

  const url = expectedCallbackUrl(req, token);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`
    );
    const json = await res.json();
    if (!json.ok) {
      const desc = typeof json.description === "string" ? redactToken(json.description, token) : undefined;
      return NextResponse.json(
        {
          error: "SET_WEBHOOK_FAILED",
          message: desc || "Webhook Telegram gagal menerima update. Periksa endpoint dan deployment.",
        },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "FETCH_FAILED", message: "Gagal menghubungi Telegram API. Coba lagi sebentar lagi." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, url: redactToken(url, token) });
}
