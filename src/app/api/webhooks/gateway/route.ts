import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFull, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";
import { getByPath } from "@/lib/get-by-path";
import { getUserSettingsDecrypted } from "@/lib/db/users";

export const runtime = "nodejs";
export const maxDuration = 300;

function verifyGatewayToken(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_VERIFY_TOKEN;
  if (!secret) return true; // no secret configured — allow (dev mode)
  const token = req.headers.get("x-webhook-token") || req.headers.get("authorization")?.replace("Bearer ", "");
  return token === secret;
}

export async function POST(req: NextRequest) {
  if (!verifyGatewayToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  handleIncomingGatewayMessage(payload).catch((err) => {
    console.error("[zales] failed to handle incoming gateway message:", err);
  });

  return NextResponse.json({ status: "ok" });
}

async function handleIncomingGatewayMessage(payload: unknown) {
  const workflows = await listWorkflowsFull();

  for (const wf of workflows) {
    const triggerNode = wf.nodes.find((n) => n.data?.kind === "trigger.whatsapp_gateway");
    if (!triggerNode) continue;

    const senderField = (triggerNode.data.params?.senderField as string) || "from";
    const textField = (triggerNode.data.params?.textField as string) || "message";
    const mediaUrlField = (triggerNode.data.params?.mediaUrlField as string) || "mediaUrl";
    const mediaTypeField = (triggerNode.data.params?.mediaTypeField as string) || "mediaType";
    const keyword = (triggerNode.data.params?.keyword as string) || "";

    const from = getByPath(payload, senderField);
    const text = getByPath(payload, textField);
    let mediaUrl: string | null = typeof getByPath(payload, mediaUrlField) === "string" ? (getByPath(payload, mediaUrlField) as string) : null;
    let mediaType: string | null = typeof getByPath(payload, mediaTypeField) === "string" ? (getByPath(payload, mediaTypeField) as string) : null;

    // Auto-detect: if configured field is empty, try common field patterns
    if (!mediaUrl) {
      const candidates = [
        "mediaUrl", "media.url", "media.link", "media.src",
        "attachment.url", "attachment.link", "image", "video",
        "file_url", "fileUrl", "url", "mediaObject.url",
        "message.image", "message.video", "message.document",
        "data.image", "data.video", "data.url", "data.media",
      ];
      for (const path of candidates) {
        const val = getByPath(payload, path);
        if (typeof val === "string" && val.startsWith("http")) {
          mediaUrl = val;
          break;
        }
      }
    }
    if (!mediaType && typeof mediaUrl === "string") {
      mediaType = guessMediaType(mediaUrl);
    }

    // Trigger if there's text OR media — allow media-only messages too
    const hasText = typeof text === "string" && text;
    const hasMedia = typeof mediaUrl === "string" && mediaUrl;
    if (!hasText && !hasMedia) continue;

    const textStr = hasText ? text : "";
    if (keyword && !textStr.toLowerCase().includes(keyword.toLowerCase())) continue;

    const collected: Array<Record<string, unknown>> = [];
    let hadError = false;
    try {
      const owner = wf.user_id ? await getUserSettingsDecrypted(wf.user_id) : {};
      await executeWorkflow({
        nodes: wf.nodes,
        edges: wf.edges,
        onLog: (entry) => collected.push(entry as unknown as Record<string, unknown>),
        onStatus: () => {},
        triggerData: {
          from: from ?? null,
          text: textStr,
          mediaUrl: hasMedia ? mediaUrl : null,
          mediaType: hasMedia ? (mediaType || (mediaUrl ? guessMediaType(mediaUrl) : null)) : null,
          raw: payload,
        },
        accountSettings: {
          rapidApiKey: owner.rapidApiKey || "",
          rapidApiHost: owner.rapidApiHost || "",
          whatsappSendUrl: owner.whatsappSendUrl || "",
          metaAccessToken: owner.metaAccessToken || "",
          metaPhoneNumberId: owner.metaPhoneNumberId || "",
          cloudinaryCloudName: owner.cloudinaryCloudName || "",
          cloudinaryApiKey: owner.cloudinaryApiKey || "",
          cloudinaryApiSecret: owner.cloudinaryApiSecret || "",
          cloudinaryFolder: owner.cloudinaryFolder || "",
          supabaseUrl: owner.supabaseUrl || "",
          supabaseKey: owner.supabaseKey || "",
          supabaseBucket: owner.supabaseBucket || "",
        },
      });
    } catch (err) {
      hadError = true;
      collected.push({
        id: "workflow-error",
        nodeId: "workflow",
        nodeLabel: "Workflow",
        status: "error",
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const status = hadError || collected.some((e) => e.status === "error") ? "error" : "success";
    await recordRun(wf.id, status, collected as never);
  }
}

function guessMediaType(url: string): string {
  const lower = url.toLowerCase();
  if (/\.mp4|\.mov|\.avi|\.webm/.test(lower)) return "video";
  if (/\.jpg|\.jpeg|\.png|\.gif|\.webp/.test(lower)) return "image";
  if (/\.pdf/.test(lower)) return "document";
  if (/\.mp3|\.ogg|\.wav|\.m4a/.test(lower)) return "audio";
  return "unknown";
}
