import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRecentLoginEvents } from "@/lib/db/users";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const events = await getRecentLoginEvents(userId, 10);
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "Failed to load login history." }, { status: 500 });
  }
}
