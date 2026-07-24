import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listApiKeys, createApiKey } from "@/lib/db/api-keys";
import { getWorkflow } from "@/lib/db/workflows";

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const keys = await listApiKeys(userId);
    return NextResponse.json(keys);
  } catch {
    return NextResponse.json({ error: "Failed to load API keys." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { workflowId?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }
  if (!body.workflowId) {
    return NextResponse.json({ error: "workflowId is required." }, { status: 400 });
  }

  const workflow = await getWorkflow(body.workflowId, userId);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  }

  try {
    const { row, plaintextKey } = await createApiKey(userId, body.workflowId, body.name);
    // plaintextKey is returned ONLY in this response — it's never stored or
    // retrievable again, so the client must show/copy it immediately.
    return NextResponse.json({ ...row, plaintextKey }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create API key." }, { status: 500 });
  }
}
