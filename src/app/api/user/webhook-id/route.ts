import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getOrCreateWebhookId } from "@/lib/db/users";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const webhookId = await getOrCreateWebhookId(userId);
    return NextResponse.json({ webhookId });
  } catch {
    return NextResponse.json({ error: "Failed to load webhook ID." }, { status: 500 });
  }
}
