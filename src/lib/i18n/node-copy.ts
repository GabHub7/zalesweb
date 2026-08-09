import type { NodeKind } from "@/types/zales";
import type { Language } from "@/lib/language-cookie";

/**
 * Translated label/description for every node in NODE_REGISTRY.
 *
 * `node-registry.ts` itself stays untouched (kind/params/param keys are
 * used as identifiers throughout the execution engine, so they can't be
 * language-dependent). This is a display-only overlay: `getNodeLabel` /
 * `getNodeDescription` below look a kind up here first, and fall back to
 * the registry's own (English-default) text if a kind is missing —
 * translation coverage can grow incrementally without ever breaking a
 * node that hasn't been added yet.
 */
type NodeCopy = { label: string; description: string };

const overlay: Partial<Record<NodeKind, Record<Language, NodeCopy>>> = {
  "trigger.manual": {
    id: { label: "Trigger Manual", description: "Jalankan workflow secara manual" },
    en: { label: "Manual Trigger", description: "Start the workflow manually" },
  },
  "trigger.schedule": {
    id: { label: "Jadwal", description: "Jalankan otomatis sesuai jadwal cron" },
    en: { label: "Schedule", description: "Run on a cron schedule" },
  },
  "trigger.webhook": {
    id: { label: "Webhook", description: "Trigger dari HTTP request yang masuk" },
    en: { label: "Webhook", description: "Trigger from an incoming HTTP request" },
  },
  "trigger.email": {
    id: { label: "Email (IMAP)", description: "Trigger saat email baru masuk" },
    en: { label: "Email (IMAP)", description: "Trigger when a new email arrives" },
  },
  "trigger.social_message": {
    id: {
      label: "Pesan Instagram/FB",
      description: "Trigger saat ada DM masuk di Instagram atau Facebook Page yang terhubung",
    },
    en: {
      label: "Instagram/FB Message",
      description: "Trigger when a DM comes in on your connected Instagram or Facebook Page",
    },
  },
  "trigger.whatsapp_gateway": {
    id: {
      label: "WhatsApp Gateway (RapidAPI)",
      description:
        "Trigger dari webhook pesan masuk yang dikirim gateway WA pihak ketiga (RapidAPI, Whapi.cloud, dll) — mendukung teks, gambar, video, dokumen. Callback URL unik per akun ada di Pengaturan Akun > API Keys > WA Gateway (RapidAPI). Untuk WhatsApp resmi dari Meta, pakai node 'WhatsApp Cloud API (Meta)'.",
    },
    en: {
      label: "WhatsApp Gateway (RapidAPI)",
      description:
        "Trigger from an incoming-message webhook sent by a third-party WA gateway (RapidAPI, Whapi.cloud, etc) — supports text, images, videos, documents. Each account's unique callback URL is in Account Settings > API Keys > WA Gateway (RapidAPI). For official Meta WhatsApp, use the 'WhatsApp Cloud API (Meta)' node instead.",
    },
  },
  "trigger.chat": {
    id: {
      label: "Chat Box",
      description:
        "Trigger dari halaman Chat AI (/chat) di dalam Zales — pesan & file yang diketik user di situ langsung memicu workflow ini. Pasangannya adalah node 'Balas ke Chat' buat ngirim jawaban balik ke chat box.",
    },
    en: {
      label: "Chat Box",
      description:
        "Trigger from Zales' own Chat AI page (/chat) — messages and files the user types there fire this workflow directly. Pairs with the 'Balas ke Chat' node to send the reply back to the chat box.",
    },
  },
  "trigger.telegram": {
    id: {
      label: "Telegram Bot",
      description:
        "Trigger dari webhook bot Telegram — pasang lewat setWebhook API Telegram ke Callback URL /api/webhooks/telegram/<BOT_TOKEN> (token di URL wajib, biar bot lo gak kecampur sama bot user lain). Bot Token dari @BotFather, isi sekali di Pengaturan Akun > API Keys biar otomatis dipakai node 'Telegram' buat balas juga.",
    },
    en: {
      label: "Telegram Bot",
      description:
        "Trigger from a Telegram bot webhook — register it via Telegram's setWebhook API pointing at /api/webhooks/telegram/<BOT_TOKEN> (the token in the URL is required, so your bot's messages never mix with another user's bot). Get a Bot Token from @BotFather, save it once in Account Settings > API Keys and the 'Telegram' node picks it up automatically for replies too.",
    },
  },
  "trigger.whatsapp_meta": {
    id: {
      label: "WhatsApp Cloud API (Meta)",
      description:
        "Trigger dari webhook resmi Meta WhatsApp Business Platform (developers.facebook.com) — pasang Callback URL /api/webhooks/whatsapp-meta dan Verify Token di Meta App dashboard. Payload sudah otomatis di-parse sesuai format resmi Meta.",
    },
    en: {
      label: "WhatsApp Cloud API (Meta)",
      description:
        "Trigger from Meta's official WhatsApp Business Platform webhook (developers.facebook.com) — register the callback URL /api/webhooks/whatsapp-meta and a Verify Token in the Meta App dashboard. The payload is parsed automatically to Meta's official format.",
    },
  },
  "ai.agent": {
    id: {
      label: "AI Agent",
      description: "Agent LLM yang bisa memutuskan sendiri kapan manggil tool/sub-agent yang di-attach (tool-calling beneran, bukan chain statis)",
    },
    en: {
      label: "AI Agent",
      description: "LLM agent that can decide on its own to call attached tools or sub-agents (real tool-calling, not a static chain)",
    },
  },
  "ai.chat": {
    id: { label: "Chat Model", description: "Chat completion satu putaran yang sederhana" },
    en: { label: "Chat Model", description: "Simple single-turn chat completion" },
  },
  "ai.image": {
    id: { label: "AI Image (Gemini)", description: "Generate gambar dari teks prompt pakai Gemini" },
    en: { label: "AI Image (Gemini)", description: "Generate an image from a text prompt using Gemini" },
  },
  "ai.vision": {
    id: {
      label: "AI Vision (Gemini)",
      description:
        "Analisa isi gambar, video, ATAU AUDIO (transkrip suara jadi teks) pakai Gemini native API — beda dari 'AI Agent' biasa (OpenAI-compatible) yang cuma baca gambar, node ini beneran bisa 'dengar' voice note dan 'nonton' video. Baca file dari upload Chat Box maupun dari mediaUrl (WhatsApp/Telegram). Cocok buat: transkrip voice note → prompt AI Video, atau attach sebagai tool ke AI Agent lain.",
    },
    en: {
      label: "AI Vision (Gemini)",
      description:
        "Analyze the contents of an image, video, OR audio (transcribes speech to text) using Gemini's native API — unlike a regular 'AI Agent' (OpenAI-compatible), which only reads images, this node can actually 'listen' to voice notes and 'watch' videos. Reads files from a Chat Box upload or a mediaUrl (WhatsApp/Telegram). Handy for: transcribing a voice note into an AI Video prompt, or attaching it as a tool to another AI Agent.",
    },
  },
  "ai.video": {
    id: {
      label: "AI Video (Veo)",
      description: "Generate video pendek dari teks prompt pakai Gemini Veo (berbayar, async — bisa makan waktu beberapa menit)",
    },
    en: {
      label: "AI Video (Veo)",
      description: "Generate a short video from a text prompt using Gemini Veo (paid, async — can take a few minutes)",
    },
  },
  "ai.memory": {
    id: { label: "Buffer Memory", description: "Menyimpan riwayat percakapan untuk sebuah agent" },
    en: { label: "Buffer Memory", description: "Stores conversation history for an agent" },
  },
  "ai.tool": {
    id: {
      label: "MCP Connector",
      description: "Hubungkan ke server MCP mana pun (Notion, Slack, GitHub, Zapier MCP, server sendiri, dll) dan panggil salah satu tool-nya",
    },
    en: {
      label: "MCP Connector",
      description: "Connect to any MCP server (Notion, Slack, GitHub, Zapier MCP, your own, etc.) and call one of its tools",
    },
  },
  "integration.sheets": {
    id: { label: "Google Sheets", description: "Baca atau tulis baris ke spreadsheet" },
    en: { label: "Google Sheets", description: "Read or write rows to a spreadsheet" },
  },
  "integration.telegram": {
    id: {
      label: "Telegram",
      description: "Kirim pesan lewat bot Telegram — berpasangan dengan trigger 'Telegram Bot' buat balas ke pengirim",
    },
    en: {
      label: "Telegram",
      description: "Send a message via Telegram bot — pairs with the 'Telegram Bot' trigger to reply back to whoever messaged it",
    },
  },
  "integration.social_reply": {
    id: { label: "Balas Instagram/FB", description: "Kirim balasan DM lewat Instagram atau Facebook Messenger" },
    en: { label: "Reply on Instagram/FB", description: "Send a DM reply back on Instagram or Facebook Messenger" },
  },
  "integration.leadfinder": {
    id: {
      label: "Lead Finder (Google Places)",
      description: "Cari bisnis lewat Google Places API resmi dan tandai mana yang belum punya website — output saja, gak auto-messaging",
    },
    en: {
      label: "Lead Finder (Google Places)",
      description: "Find businesses via the official Google Places API and flag which ones have no website — output only, no auto-messaging",
    },
  },
  "integration.social": {
    id: { label: "Post Media Sosial", description: "Posting caption + media ke platform sosial (atau export buat upload manual)" },
    en: { label: "Social Media Post", description: "Post caption + media to a social platform (or export for manual upload)" },
  },
  "integration.slack": {
    id: { label: "Slack", description: "Kirim pesan ke channel Slack lewat Incoming Webhook URL" },
    en: { label: "Slack", description: "Send a message to a Slack channel via an Incoming Webhook URL" },
  },
  "integration.discord": {
    id: { label: "Discord", description: "Kirim pesan ke channel Discord lewat Webhook URL" },
    en: { label: "Discord", description: "Send a message to a Discord channel via a Webhook URL" },
  },
  "integration.notion": {
    id: { label: "Notion", description: "Buat halaman di database Notion lewat Notion API" },
    en: { label: "Notion", description: "Create a page in a Notion database via the Notion API" },
  },
  "integration.airtable": {
    id: { label: "Airtable", description: "Buat record di tabel Airtable lewat Personal Access Token" },
    en: { label: "Airtable", description: "Create a record in an Airtable table via a Personal Access Token" },
  },
  "integration.email_send": {
    id: { label: "Kirim Email", description: "Kirim email transaksional lewat Resend" },
    en: { label: "Send Email", description: "Send a transactional email via Resend" },
  },
  "integration.twilio_sms": {
    id: { label: "Twilio SMS", description: "Kirim SMS lewat Twilio REST API" },
    en: { label: "Twilio SMS", description: "Send an SMS via the Twilio REST API" },
  },
  "integration.whatsapp_reply": {
    id: {
      label: "Kirim Balasan WhatsApp",
      description:
        "Kirim balasan WhatsApp — default pakai Meta WhatsApp Cloud API resmi (developers.facebook.com), atau pilih RapidAPI kalau masih pakai gateway pihak ketiga lama.",
    },
    en: {
      label: "Send WhatsApp Reply",
      description:
        "Send a WhatsApp reply — defaults to the official Meta WhatsApp Cloud API (developers.facebook.com), or pick RapidAPI if you're still on an older third-party gateway.",
    },
  },
  "integration.google_maps_scraper": {
    id: {
      label: "Google Maps Scraper",
      description:
        "Scrape data bisnis dari Google Maps via RapidAPI (Google Map Scraper) — cari tempat, detail satu tempat, atau auto-complete. Bisa di-attach ke AI Agent sebagai tool biar agent WA bisa cariin lokasi/toko sesuai chat.",
    },
    en: {
      label: "Google Maps Scraper",
      description:
        "Scrape business data from Google Maps via RapidAPI (Google Map Scraper) — search places, get a single place's detail, or auto-complete. Can be attached to an AI Agent as a tool so a WA agent can look up locations/shops from chat.",
    },
  },
  "integration.chat_reply": {
    id: {
      label: "Balas ke Chat",
      description:
        "Kirim balasan akhir yang ditampilkan di halaman Chat AI (/chat) — pasangan dari trigger 'Chat Box'. Taruh di ujung workflow setelah AI Agent/proses lain selesai.",
    },
    en: {
      label: "Balas ke Chat",
      description:
        "Send the final reply shown on the Chat AI page (/chat) — pairs with the 'Chat Box' trigger. Place it at the end of the workflow, after the AI Agent/other processing finishes.",
    },
  },
  "integration.telegram_reply": {
    id: {
      label: "Balas ke Telegram",
      description:
        "Kirim balasan otomatis ke chat Telegram yang memicu workflow ini — pasangan dari trigger 'Telegram Bot'. Chat ID otomatis diambil dari trigger, gak perlu isi manual. Taruh di ujung workflow setelah AI Agent/proses lain selesai.",
    },
    en: {
      label: "Balas ke Telegram",
      description:
        "Automatically reply to the Telegram chat that triggered this workflow — pairs with the 'Telegram Bot' trigger. Chat ID is picked up from the trigger automatically, no manual entry needed. Place it at the end of the workflow, after the AI Agent/other processing finishes.",
    },
  },
  "integration.youtube_upload": {
    id: {
      label: "Upload ke YouTube",
      description:
        "Upload video ke YouTube pakai YouTube Data API v3 (resumable upload). Butuh OAuth Client ID/Secret + Refresh Token dari Google Cloud Console (scope: youtube.upload). Video bisa dari hasil node 'AI Video (Veo)' atau file upload user.",
    },
    en: {
      label: "Upload to YouTube",
      description:
        "Upload a video to YouTube using YouTube Data API v3 (resumable upload). Needs an OAuth Client ID/Secret + Refresh Token from Google Cloud Console (scope: youtube.upload). The video can come from an 'AI Video (Veo)' node's output or a user's uploaded file.",
    },
  },
  "integration.tiktok_upload": {
    id: {
      label: "Upload ke TikTok",
      description:
        "Upload video ke TikTok pakai TikTok Content Posting API v2. Butuh Access Token dari TikTok Developer Portal — akun harus sudah lolos App Review TikTok untuk publish ke akun publik (sebelum itu, cuma bisa ke sandbox/akun developer sendiri). Video bisa dari URL publik atau file upload user lewat Chat Box.",
    },
    en: {
      label: "Upload to TikTok",
      description:
        "Upload a video to TikTok using the TikTok Content Posting API v2. Needs an Access Token from the TikTok Developer Portal — the account must pass TikTok's App Review to publish to a public account (before that, it can only post to a sandbox/developer account). The video can come from a public URL or a user's file uploaded via Chat Box.",
    },
  },
  "integration.gamma_generate": {
    id: {
      label: "Generate Presentasi (Gamma)",
      description:
        "Generate presentasi/dokumen/social post/webpage otomatis pakai Gamma API (gamma.app) dari teks — cocok buat 'buatkan PPT tentang X'. Butuh Gamma API Key (minimal plan Pro). Prosesnya async: node ini otomatis polling sampai selesai lalu mengembalikan link Gamma dan link download file.",
    },
    en: {
      label: "Generate Presentation (Gamma)",
      description:
        "Automatically generate a presentation/document/social post/webpage from text using the Gamma API (gamma.app) — handy for 'make me a deck about X'. Needs a Gamma API Key (Pro plan minimum). The process is async: this node polls automatically until it's done, then returns the Gamma link and a file download link.",
    },
  },
  "integration.supabase_storage": {
    id: {
      label: "Supabase Storage",
      description: "Upload file ke Supabase Storage dan kembalikan URL publik — isi credentials di node atau di Pengaturan Akun",
    },
    en: {
      label: "Supabase Storage",
      description: "Upload file to Supabase Storage and return public URL — set credentials on the node or in Account Settings",
    },
  },
  "integration.media_upload": {
    id: {
      label: "Media Upload (Cloudinary)",
      description: "Upload gambar/video dari URL ke Cloudinary — isi credentials di node atau di Pengaturan Akun",
    },
    en: {
      label: "Media Upload (Cloudinary)",
      description: "Upload image/video from URL to Cloudinary — set credentials on the node or in Account Settings",
    },
  },
  "office.excel": {
    id: { label: "Generate Excel", description: "Bikin file .xlsx dari data JSON (array baris)" },
    en: { label: "Generate Excel", description: "Build an .xlsx file from JSON data (array of rows)" },
  },
  "office.word": {
    id: { label: "Generate Word", description: "Bikin dokumen .docx dari judul + paragraf" },
    en: { label: "Generate Word", description: "Build a .docx document from a title + paragraphs" },
  },
  "office.pptx": {
    id: { label: "Generate PowerPoint", description: "Bikin file .pptx dari daftar slide berformat JSON" },
    en: { label: "Generate PowerPoint", description: "Build a .pptx deck from a JSON list of slides" },
  },
  "integration.file": {
    id: { label: "File Lokal", description: "Baca file TXT, PDF, atau JSON lokal" },
    en: { label: "Local File", description: "Read a local TXT, PDF, or JSON file" },
  },
  "integration.http": {
    id: { label: "HTTP Request", description: "Panggil API HTTP eksternal" },
    en: { label: "HTTP Request", description: "Call an external HTTP API" },
  },
  "transform.code": {
    id: { label: "Code", description: "Jalankan JavaScript custom terhadap data input" },
    en: { label: "Code", description: "Run custom JavaScript on the input data" },
  },
  "transform.json": {
    id: { label: "Edit JSON", description: "Map atau bentuk ulang field pada data" },
    en: { label: "Edit JSON", description: "Map or reshape fields on the data" },
  },
  "transform.merge": {
    id: { label: "Merge", description: "Gabungkan beberapa input jadi satu object" },
    en: { label: "Merge", description: "Combine multiple inputs into one object" },
  },
  "transform.set": {
    id: { label: "Set Fields", description: "Tambah atau timpa field pada data yang lewat" },
    en: { label: "Set Fields", description: "Add or overwrite fields on the data passing through" },
  },
  "transform.filter": {
    id: {
      label: "Filter",
      description: "Hentikan item di sini kalau kondisi salah — node berikutnya cuma jalan untuk item yang lolos",
    },
    en: {
      label: "Filter",
      description: "Stop the item here if a condition is false — downstream nodes only run for items that pass",
    },
  },
  "logic.if": {
    id: { label: "If / Else", description: "Cabangkan workflow berdasarkan sebuah kondisi" },
    en: { label: "If / Else", description: "Branch the workflow based on a condition" },
  },
  "logic.switch": {
    id: {
      label: "Switch",
      description: "Arahkan berdasarkan salah satu dari beberapa nilai yang cocok dengan input (multi-cabang)",
    },
    en: {
      label: "Switch",
      description: "Route based on which of several values matches the input (multi-branch)",
    },
  },
  "logic.wait": {
    id: {
      label: "Wait",
      description: "Jeda beberapa detik sebelum lanjut (dibatasi biar tetap dalam limit serverless)",
    },
    en: {
      label: "Wait",
      description: "Pause for a fixed number of seconds before continuing (capped to stay within serverless limits)",
    },
  },
  "logic.loop": {
    id: { label: "Loop", description: "Iterasi lewat sebuah daftar item" },
    en: { label: "Loop", description: "Iterate over a list of items" },
  },
};

/** Looks up the translated label for a node kind, falling back to
 * whatever `node-registry.ts` itself defines if this kind hasn't been
 * added to the overlay yet (keeps new/experimental nodes from ever
 * rendering blank). */
export function getNodeLabel(kind: NodeKind, language: Language, registryLabel: string): string {
  return overlay[kind]?.[language]?.label ?? registryLabel;
}

export function getNodeDescription(kind: NodeKind, language: Language, registryDescription: string): string {
  return overlay[kind]?.[language]?.description ?? registryDescription;
}
