import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteApiKey } from "@/lib/db/api-keys";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteApiKey(id, userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete API key." }, { status: 500 });
  }
}
