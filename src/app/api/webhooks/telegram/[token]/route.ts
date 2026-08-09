import { NextRequest, NextResponse } from "next/server";
import { listWorkflowsFull, recordRun } from "@/lib/db/workflows";
import { executeWorkflow } from "@/lib/execution-engine";
import { getUserSettingsDecrypted } from "@/lib/db/users";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Telegram Bot webhook — scoped to one bot via the URL path itself.
 *
 * Telegram's payload never identifies which bot an update belongs to (no
 * bot ID or token in the body), so a single shared endpoint has no way to
 * tell "this message is for User A's bot" apart from "User B's bot" —
 * dispatching to every workflow that has a Telegram trigger would leak
 * every user's Telegram messages into every other user's workflows.
 * Putting the bot token in the URL itself is what Telegram's own docs
 * recommend for exactly this reason: each bot gets its own unique,
 * unguessable callback URL.
 *
 * Setup (no App Review needed — active as soon as you set the webhook):
 *   1. Get a Bot Token from @BotFather on Telegram (/newbot)
 *   2. Save it in Pengaturan Akun > API Keys > Telegram Bot Token
 *   3. Point Telegram at this endpoint by calling, once:
 *        https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/webhooks/telegram/<TOKEN>
 *
 * Docs: https://core.telegram.org/bots/api#setwebhook
 */

interface TelegramPhotoSize {
  file_id?: string;
}
interface TelegramMessage {
  chat?: { id?: number | string };
  from?: { id?: number | string; username?: string; first_name?: string };
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: { file_id?: string; mime_type?: string; file_name?: string };
  video?: { file_id?: string; mime_type?: string };
  voice?: { file_id?: string; mime_type?: string };
}
interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: botToken } = await params;

  let payload: TelegramUpdate;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  // Telegram expects a fast 200 (and will retry/give up if it's slow) —
  // process the workflow in the background rather than blocking the response.
  handleIncomingTelegramMessage(botToken, payload).catch((err) => {
    console.error("[zales] failed to handle incoming Telegram message:", err);
  });

  return NextResponse.json({ ok: true });
}

async function handleIncomingTelegramMessage(botToken: string, payload: TelegramUpdate) {
  const msg = payload.message || payload.edited_message;
  if (!msg?.chat?.id) return;

  const chatId = String(msg.chat.id);
  const from = msg.from?.username || msg.from?.first_name || String(msg.from?.id || "");

  const text = msg.text || msg.caption || "";
  let fileId: string | null = null;
  let mediaType: string | null = null;

  if (msg.photo && msg.photo.length > 0) {
    // Telegram sends multiple resolutions — the last one is the largest.
    fileId = msg.photo[msg.photo.length - 1].file_id || null;
    mediaType = "image";
  } else if (msg.video?.file_id) {
    fileId = msg.video.file_id;
    mediaType = "video";
  } else if (msg.voice?.file_id) {
    fileId = msg.voice.file_id;
    mediaType = "audio";
  } else if (msg.document?.file_id) {
    fileId = msg.document.file_id;
    mediaType = "document";
  }

  await dispatchToWorkflows(botToken, { chatId, from, text, fileId, mediaType });
}

async function dispatchToWorkflows(
  botToken: string,
  triggerData: { chatId: string; from: string; text: string; fileId: string | null; mediaType: string | null }
) {
  const workflows = await listWorkflowsFull();

  for (const wf of workflows) {
    const triggerNode = wf.nodes.find((n) => n.data?.kind === "trigger.telegram");
    if (!triggerNode) continue;
    if (!wf.user_id) continue;

    // Tenant isolation: only run this workflow if its owner's saved bot
    // token (or the trigger's own override) matches the token this
    // specific webhook URL was called with. Without this check, any bot's
    // incoming messages would fan out to every user's Telegram workflows.
    const owner = await getUserSettingsDecrypted(wf.user_id);
    const botTokenFilter = (triggerNode.data.params?.botTokenFilter as string) || "";
    const ownerBotToken = botTokenFilter || owner.telegramBotToken || "";
    if (!ownerBotToken || ownerBotToken !== botToken) continue;

    const keyword = (triggerNode.data.params?.keyword as string) || "";
    if (keyword && !triggerData.text.toLowerCase().includes(keyword.toLowerCase())) continue;
    if (!triggerData.text && !triggerData.fileId) continue;

    const collected: Array<Record<string, unknown>> = [];
    let hadError = false;
    try {
      // Telegram only gives a file_id, not a direct URL — resolve it to a
      // real download URL via getFile, same shape as WhatsApp's media_id.
      let mediaUrl: string | null = null;
      if (triggerData.fileId) {
        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${triggerData.fileId}`);
          if (fileRes.ok) {
            const fileJson = await fileRes.json();
            const filePath = fileJson?.result?.file_path;
            if (filePath) mediaUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
          }
        } catch {
          // best-effort — workflow still runs without the media URL
        }
      }

      await executeWorkflow({
        nodes: wf.nodes,
        edges: wf.edges,
        onLog: (entry) => collected.push(entry as unknown as Record<string, unknown>),
        onStatus: () => {},
        triggerData: {
          botToken,
          chatId: triggerData.chatId,
          from: triggerData.from,
          text: triggerData.text,
          mediaUrl,
          mediaType: triggerData.fileId ? triggerData.mediaType : null,
        },
        accountSettings: {
          rapidApiKey: owner.rapidApiKey || "",
          rapidApiHost: owner.rapidApiHost || "",
          whatsappSendUrl: owner.whatsappSendUrl || "",
          metaAccessToken: owner.metaAccessToken || "",
          metaPhoneNumberId: owner.metaPhoneNumberId || "",
          telegramBotToken: owner.telegramBotToken || "",
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
