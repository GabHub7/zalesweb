import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFull, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";
import { getUserSettingsDecrypted } from "@/lib/db/users";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Webhook resmi Meta WhatsApp Business Platform.
 * Setup di Meta App dashboard > WhatsApp > Configuration:
 *   Callback URL : https://<domain-lo>/api/webhooks/whatsapp-meta
 *   Verify Token : samain dengan "Verify Token" yang lo isi di
 *                  Pengaturan Akun > WhatsApp Cloud API (Meta), atau
 *                  env var WEBHOOK_VERIFY_TOKEN sebagai fallback global.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
 */

// --- GET: verification handshake Meta (hub.challenge) ---
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // 1) cek env var global dulu (paling simpel buat 1 akun / dev mode)
  if (process.env.WEBHOOK_VERIFY_TOKEN && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  // 2) cek per-user metaVerifyToken (buat multi-tenant — tiap user App Meta sendiri)
  const workflows = await listWorkflowsFull();
  const ownerIds = new Set(workflows.map((wf) => wf.user_id).filter((id): id is string => !!id));
  for (const userId of ownerIds) {
    const settings = await getUserSettingsDecrypted(userId);
    if (settings.metaVerifyToken && settings.metaVerifyToken === token) {
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// --- Meta WhatsApp Cloud API payload shape ---
interface MetaWaMessage {
  from?: string; // sender phone number, digits only, no "+"
  type?: string; // "text" | "image" | "video" | "document" | "audio" | ...
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
}
interface MetaWaValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  messages?: MetaWaMessage[];
}
interface MetaWaChange {
  field?: string;
  value?: MetaWaValue;
}
interface MetaWaEntry {
  id?: string;
  changes?: MetaWaChange[];
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  // Meta expects a fast 200 — proses workflow di background, jangan nunggu.
  handleIncomingMetaMessage(payload).catch((err) => {
    console.error("[zales] failed to handle incoming Meta WhatsApp message:", err);
  });

  return NextResponse.json({ status: "ok" });
}

async function handleIncomingMetaMessage(payload: unknown) {
  const entries: MetaWaEntry[] = (payload as { entry?: MetaWaEntry[] })?.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field && change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;

      for (const msg of value?.messages || []) {
        const from = msg.from;
        if (!from) continue;

        let text = "";
        let mediaId: string | null = null;
        let mediaType: string | null = null;
        switch (msg.type) {
          case "text":
            text = msg.text?.body || "";
            break;
          case "image":
            mediaId = msg.image?.id || null;
            mediaType = "image";
            text = msg.image?.caption || "";
            break;
          case "video":
            mediaId = msg.video?.id || null;
            mediaType = "video";
            text = msg.video?.caption || "";
            break;
          case "document":
            mediaId = msg.document?.id || null;
            mediaType = "document";
            text = msg.document?.caption || "";
            break;
          case "audio":
            mediaId = msg.audio?.id || null;
            mediaType = "audio";
            break;
          default:
            break;
        }

        await dispatchToWorkflows({ from, text, mediaId, mediaType, phoneNumberId, raw: payload });
      }
    }
  }
}

async function dispatchToWorkflows(triggerData: {
  from: string;
  text: string;
  mediaId: string | null;
  mediaType: string | null;
  phoneNumberId: string | undefined;
  raw: unknown;
}) {
  const workflows = await listWorkflowsFull();

  for (const wf of workflows) {
    const triggerNode = wf.nodes.find((n) => n.data?.kind === "trigger.whatsapp_meta");
    if (!triggerNode) continue;

    const phoneFilter = (triggerNode.data.params?.phoneNumberIdFilter as string) || "";
    const keyword = (triggerNode.data.params?.keyword as string) || "";

    if (phoneFilter && phoneFilter !== triggerData.phoneNumberId) continue;
    if (keyword && !triggerData.text.toLowerCase().includes(keyword.toLowerCase())) continue;
    if (!triggerData.text && !triggerData.mediaId) continue;

    const collected: Array<Record<string, unknown>> = [];
    let hadError = false;
    try {
      const owner = wf.user_id ? await getUserSettingsDecrypted(wf.user_id) : {};

      // Media dari Meta cuma dikasih media ID, bukan URL langsung — perlu 1x
      // GET https://graph.facebook.com/v21.0/<media_id> pakai access token buat dapetin URL asli.
      let mediaUrl: string | null = null;
      if (triggerData.mediaId && owner.metaAccessToken) {
        try {
          const metaRes = await fetch(`https://graph.facebook.com/v21.0/${triggerData.mediaId}`, {
            headers: { Authorization: `Bearer ${owner.metaAccessToken}` },
          });
          if (metaRes.ok) {
            const metaJson = (await metaRes.json()) as { url?: string };
            mediaUrl = metaJson.url || null;
          }
        } catch {
          // best-effort — kalau gagal, workflow tetep jalan tanpa media URL
        }
      }

      await executeWorkflow({
        nodes: wf.nodes,
        edges: wf.edges,
        onLog: (entry) => collected.push(entry as unknown as Record<string, unknown>),
        onStatus: () => {},
        triggerData: {
          from: triggerData.from,
          text: triggerData.text,
          mediaUrl,
          mediaType: triggerData.mediaId ? triggerData.mediaType : null,
          raw: triggerData.raw,
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
