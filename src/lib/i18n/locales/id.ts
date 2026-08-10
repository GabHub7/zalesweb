/**
 * Bahasa Indonesia — bahasa default Zales.
 *
 * Terorganisir per namespace (README §11.1) supaya gampang dicari & di-scan
 * saat komponen baru butuh string baru. Jangan taruh translation logic
 * tersebar (`language === "id" ? ... : ...`) di komponen — selalu lewat
 * `t("namespace.key")`.
 */
const id = {
  common: {
    save: "Simpan",
    cancel: "Batal",
    close: "Tutup",
    delete: "Hapus",
    edit: "Ubah",
    loading: "Memuat...",
    saving: "Menyimpan...",
    error: "Terjadi kesalahan",
    retry: "Coba lagi",
    copy: "Salin",
    copied: "Tersalin!",
  },
  nav: {
    chatAi: "Chat AI",
    apiKeys: "API Keys",
    new: "Baru",
    open: "Buka",
    save: "Simpan",
    runLog: "Run log",
    history: "Riwayat",
    settings: "Pengaturan",
    run: "Run",
    running: "Menjalankan...",
  },
  runlog: {
    title: "Run log",
    historyTitle: "Riwayat Eksekusi",
    historyHint:
      'Termasuk run yang dipicu dari luar (webhook RapidAPI/WhatsApp, jadwal, dll) — bukan cuma yang kamu klik "Run" manual. Buka salah satu, expand node trigger-nya buat lihat payload mentah yang beneran masuk.',
    empty: "Belum ada execution.",
    emptyHint: "Jalankan workflow untuk melihat hasilnya.",
    emptyDrawer: "Belum ada run. Klik Run untuk menjalankan workflow.",
    loadFailed: "Gagal load riwayat.",
    clear: "Clear",
    node: "node",
  },
  settings: {
    telegramTitle: "Telegram Bot",
    telegramWebhookStatus: "Status Webhook",
    telegramRecheck: "Cek ulang",
    telegramChecking: "Mengecek...",
    telegramRegister: "Daftarkan Webhook",
    telegramRegistering: "Mendaftarkan...",
    telegramSaveTokenFirst:
      'Simpan Bot Token dulu — status webhook & tombol "Daftarkan Webhook" muncul di sini setelah token tersimpan.',
    telegramWebhookActive: "Webhook aktif & mengarah ke Zales.",
    telegramWebhookMismatch: 'Webhook aktif, tapi URL-nya beda dari deployment ini — klik "Daftarkan Webhook" untuk perbaiki.',
    telegramWebhookMissing: 'Webhook Telegram belum dikonfigurasi. Klik "Daftarkan Webhook" untuk memasangnya.',
    telegramUrlLabel: "URL",
    telegramPendingUpdates: "Update tertunda",
    telegramLastError: "Error terakhir",
  },
  telegram: {
    webhookNotConfigured: "Webhook Telegram belum dikonfigurasi.",
    webhookCheckUrlAndToken: "Periksa URL webhook dan Bot Token.",
    webhookFailed: "Webhook Telegram gagal menerima update.",
    webhookCheckEndpoint: "Periksa endpoint dan deployment.",
    invalidToken: "Bot Token Telegram tidak valid.",
    checkTokenFromBotfather: "Periksa token dari @BotFather.",
  },
  language: {
    selectorLabel: "Bahasa",
    id: "Bahasa Indonesia",
    en: "English",
  },
  sidebar: {
    title: "Nodes",
    subtitle: "Drag onto the canvas",
    searchPlaceholder: "Cari node...",
    noMatches: 'Gak ada node yang cocok dengan "{query}".',
  },
  inspector: {
    noParams: "This node has no configurable parameters.",
    testNode: "Test node",
    testing: "Testing...",
    testSuccess: "Node ran successfully.",
  },
  workflows: {
    title: "Workflow Saya",
    loading: "Memuat...",
    empty: "Belum ada workflow tersimpan. Bikin sesuatu lalu klik Simpan.",
    updated: "Diperbarui",
    loadFailed: "Gagal load workflow.",
    deleteFailed: "Gagal hapus workflow.",
    deleteConfirm: "Hapus workflow ini? Gak bisa dibatalin.",
    fetchFailed: "Gagal load.",
  },
  chat: {
    title: "Zales Chat",
    workflowLabel: "Workflow",
    noWorkflows: "Belum ada workflow",
    noConversations: "Belum ada percakapan.",
    newConversation: "Mulai percakapan baru",
    toggleSidebar: "Toggle sidebar",
    selectOrCreate: "Pilih atau buat percakapan",
    logout: "Logout",
    attachFile: "Lampirkan file",
    messagePlaceholder: "Tulis pesan... (Shift+Enter untuk baris baru)",
    pickWorkflowHint: "Pilih workflow di kiri, lalu klik + untuk mulai percakapan baru.",
    emptyMessagesHint: "Ngobrol bebas di sini — bisa lampirkan gambar, PDF, ZIP, atau file lainnya.",
  },
} as const;

export default id;
