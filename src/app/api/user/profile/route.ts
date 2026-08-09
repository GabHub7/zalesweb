import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserProfile, updateUserProfile, countUserWorkflows } from "@/lib/db/users";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [profile, workflowCount] = await Promise.all([
      getUserProfile(userId),
      countUserWorkflows(userId),
    ]);
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...profile, workflowCount });
  } catch {
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;
    const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : undefined;
    if (name !== undefined && name.length === 0) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    await updateUserProfile(userId, { name, timezone });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
  }
}
