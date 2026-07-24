import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserSettingsMasked, updateUserSettings } from "@/lib/db/users";

const ALLOWED_KEYS = new Set([
  "geminiApiKey",
  "googlePlacesApiKey",
  "openaiApiKey",
  "customBaseUrl",
  "customModelName",
  "customApiKey",
  "rapidApiKey",
  "rapidApiHost",
  "whatsappSendUrl",
  "metaAccessToken",
  "metaPhoneNumberId",
  "metaWabaId",
  "metaVerifyToken",
  "cloudinaryCloudName",
  "cloudinaryApiKey",
  "cloudinaryApiSecret",
  "cloudinaryFolder",
  "supabaseUrl",
  "supabaseKey",
  "supabaseBucket",
]);

function sanitizeSettings(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (ALLOWED_KEYS.has(k) && typeof v === "string") {
      result[k] = v.slice(0, 500);
    }
  }
  return result;
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Masked — safe to send to the browser. Real values never leave the server.
    const settings = await getUserSettingsMasked(userId);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Failed to load settings." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const safe = sanitizeSettings(body);
    const settings = await updateUserSettings(userId, safe);
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
