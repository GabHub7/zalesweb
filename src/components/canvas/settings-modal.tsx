"use client";

import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { signOut } from "next-auth/react";
import { useZalesStore } from "@/store/zales-store";

// Sentinel meaning "field left untouched" — server keeps the existing
// encrypted value instead of overwriting it with this literal string.
// Mirrors UNCHANGED_SENTINEL in src/lib/crypto.ts (kept as a plain string
// here so this client component never bundles the server crypto module).
const UNCHANGED = "__UNCHANGED__";

type Tab = "profile" | "security" | "apikeys" | "data" | "help" | "danger";

const TABS: { id: Tab; label: string; icon: keyof typeof Icons }[] = [
  { id: "profile", label: "Profil", icon: "User" },
  { id: "security", label: "Keamanan", icon: "ShieldCheck" },
  { id: "apikeys", label: "API Key", icon: "KeyRound" },
  { id: "data", label: "Data Saya", icon: "Database" },
  { id: "help", label: "Bantuan", icon: "LifeBuoy" },
  { id: "danger", label: "Zona Bahaya", icon: "TriangleAlert" },
];

const labelClass = "mb-1 block text-[11.5px] font-semibold text-neutral-600 dark:text-neutral-400";
const inputClass =
  "w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12.5px] text-neutral-900 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[560px] w-[720px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        {/* Sidebar nav */}
        <div className="flex w-44 shrink-0 flex-col border-r border-neutral-100 bg-neutral-50/50 p-2 dark:border-neutral-800 dark:bg-neutral-900/30">
          <div className="mb-2 flex items-center gap-1.5 px-2 py-1.5">
            <Icons.Settings size={14} className="text-neutral-700 dark:text-neutral-300" />
            <span className="text-[12.5px] font-bold text-neutral-900 dark:text-neutral-100">Pengaturan</span>
          </div>
          {TABS.map((item) => {
            const Icon = Icons[item.icon] as React.ComponentType<{ size?: number }>;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors ${
                  tab === item.id
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-500 hover:bg-white/60 dark:text-neutral-400 dark:hover:bg-neutral-800/60"
                } ${item.id === "danger" ? "mt-auto" : ""}`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b border-neutral-100 px-4 py-2.5 dark:border-neutral-800">
            <button
              onClick={onClose}
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Icons.X size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {tab === "profile" && <ProfileTab />}
            {tab === "security" && <SecurityTab />}
            {tab === "apikeys" && <ApiKeysTab />}
            {tab === "data" && <DataTab />}
            {tab === "help" && <HelpTab />}
            {tab === "danger" && <DangerTab onClose={onClose} />}
          </div>
        </div>
      </div>
    </>
  );
}

// ───────────────────────────── Profile ─────────────────────────────

interface Profile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  timezone: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  hasPassword: boolean;
  workflowCount: number;
}

function ProfileTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function loadProfile() {
    setLoadError(null);
    fetch("/api/user/profile")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.id) {
          throw new Error(data?.error || `Gagal load profil (${r.status}).`);
        }
        setProfile(data);
        setName(data.name || "");
        setTimezone(data.timezone || "Asia/Jakarta");
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error
            ? `${err.message} Kemungkinan migration database "005_user_settings_profile.sql" belum dijalankan.`
            : "Gagal load profil."
        );
      });
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Gagal simpan (${res.status}).`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal simpan profil.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-red-500">{loadError}</p>
        <button
          onClick={loadProfile}
          className="rounded-md border border-neutral-200 px-2.5 py-1 text-[11.5px] font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (!profile) {
    return <p className="text-[12.5px] text-neutral-400">Memuat profil...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {profile.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.image} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200 text-[15px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {(profile.name || profile.email)[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            {profile.name || "Belum ada nama"}
          </p>
          <p className="text-[11.5px] text-neutral-400">{profile.email}</p>
        </div>
      </div>

      <div>
        <label className={labelClass}>Nama Lengkap</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Alamat Email Utama</label>
        <input value={profile.email} disabled className={`${inputClass} opacity-60`} />
      </div>

      <div>
        <label className={labelClass}>Zona Waktu Kerja</label>
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
          <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
          <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
          <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[11.5px] text-green-600 dark:text-green-400">{saved && "✓ Tersimpan"}</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {saving ? "Menyimpan..." : "Simpan Profil"}
        </button>
      </div>
      {saveError && <p className="text-[11.5px] text-red-500">{saveError}</p>}
    </div>
  );
}

// ───────────────────────────── Security ─────────────────────────────

function SecurityTab() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [events, setEvents] = useState<{ id: string; ip: string | null; user_agent: string | null; created_at: string }[]>([]);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => setHasPassword(!!data?.hasPassword))
      .catch(() => setHasPassword(false));
    fetch("/api/user/login-events")
      .then((r) => r.json())
      .then((data) => setEvents(data?.events || []))
      .catch(() => {});
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Konfirmasi password tidak cocok." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Gagal mengubah password." });
      } else {
        setMessage({ type: "ok", text: "Password berhasil diperbarui." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setHasPassword(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
          {hasPassword ? "Ubah Kata Sandi" : "Buat Kata Sandi (Akun Google)"}
        </h4>
        <form onSubmit={handleChangePassword} className="space-y-2.5">
          {hasPassword && (
            <div>
              <label className={labelClass}>Kata Sandi Saat Ini</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className={labelClass}>Kata Sandi Baru</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              minLength={8}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Konfirmasi Kata Sandi Baru</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              minLength={8}
              required
            />
          </div>
          {message && (
            <p className={`text-[11.5px] ${message.type === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {saving ? "Menyimpan..." : "Perbarui Kata Sandi"}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-neutral-400">
          Lupa kata sandi? Logout lalu pakai tautan &quot;Lupa password?&quot; di halaman login untuk mengirim link
          reset ke email kamu.
        </p>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

      <div>
        <h4 className="mb-3 text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
          Log Aktivitas Login Terakhir
        </h4>
        {events.length === 0 ? (
          <p className="text-[11.5px] text-neutral-400">Belum ada riwayat login tercatat.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between rounded-md bg-neutral-50 px-2.5 py-1.5 text-[11.5px] text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
              >
                <span className="truncate">{ev.ip || "IP tidak diketahui"}</span>
                <span className="shrink-0 text-neutral-400">{new Date(ev.created_at).toLocaleString("id-ID")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── API Keys ─────────────────────────────

function ApiKeysTab() {
  const userSettings = useZalesStore((s) => s.userSettings);
  const saveUserSettings = useZalesStore((s) => s.saveUserSettings);
  const fetchUserSettings = useZalesStore((s) => s.fetchUserSettings);

  const [fields, setFields] = useState({
    geminiApiKey: "",
    googlePlacesApiKey: "",
    openaiApiKey: "",
    customBaseUrl: "",
    customModelName: "",
    customApiKey: "",
    rapidApiKey: "",
    rapidApiHost: "",
    whatsappSendUrl: "",
    metaAccessToken: "",
    metaPhoneNumberId: "",
    metaWabaId: "",
    metaVerifyToken: "",
    cloudinaryCloudName: "",
    cloudinaryApiKey: "",
    cloudinaryApiSecret: "",
    cloudinaryFolder: "zales-uploads",
    supabaseUrl: "",
    supabaseKey: "",
    supabaseBucket: "media",
  });
  // Tracks which secret fields the user actually typed into, so untouched
  // masked values ("sk-a...9xyz") never get sent back as if they were real.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserSettings().then((ok) => {
      if (!ok) setLoadError("Gagal load API key tersimpan. Coba tutup dan buka lagi Pengaturan Akun.");
    });
  }, [fetchUserSettings]);

  useEffect(() => {
    setFields({
      geminiApiKey: userSettings.geminiApiKey || "",
      googlePlacesApiKey: userSettings.googlePlacesApiKey || "",
      openaiApiKey: userSettings.openaiApiKey || "",
      customBaseUrl: userSettings.customBaseUrl || "",
      customModelName: userSettings.customModelName || "",
      customApiKey: userSettings.customApiKey || "",
      rapidApiKey: userSettings.rapidApiKey || "",
      rapidApiHost: userSettings.rapidApiHost || "",
      whatsappSendUrl: userSettings.whatsappSendUrl || "",
      metaAccessToken: userSettings.metaAccessToken || "",
      metaPhoneNumberId: userSettings.metaPhoneNumberId || "",
      metaWabaId: userSettings.metaWabaId || "",
      metaVerifyToken: userSettings.metaVerifyToken || "",
      cloudinaryCloudName: userSettings.cloudinaryCloudName || "",
      cloudinaryApiKey: userSettings.cloudinaryApiKey || "",
      cloudinaryApiSecret: userSettings.cloudinaryApiSecret || "",
      cloudinaryFolder: userSettings.cloudinaryFolder || "zales-uploads",
      supabaseUrl: userSettings.supabaseUrl || "",
      supabaseKey: userSettings.supabaseKey || "",
      supabaseBucket: userSettings.supabaseBucket || "media",
    });
  }, [userSettings]);

  function setSecretField(key: keyof typeof fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const SECRET_KEYS = ["geminiApiKey", "googlePlacesApiKey", "openaiApiKey", "customApiKey", "rapidApiKey", "cloudinaryApiSecret", "supabaseKey", "metaAccessToken", "metaVerifyToken"] as const;
    const payload: Record<string, string> = { ...fields };
    for (const key of SECRET_KEYS) {
      if (!touched[key]) payload[key] = UNCHANGED;
    }
    const ok = await saveUserSettings(payload);
    setSaving(false);
    if (ok) {
      setTouched({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setSaveError("Gagal menyimpan API key. Cek koneksi, lalu coba lagi.");
    }
  }

  const keyField = (key: keyof typeof fields, label: string, placeholder: string) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type="password"
        placeholder={placeholder}
        value={fields[key]}
        onChange={(e) => setSecretField(key, e.target.value)}
        className={inputClass}
      />
      {!touched[key] && fields[key] && (
        <p className="mt-0.5 text-[10.5px] text-neutral-400">Tersimpan &amp; terenkripsi — masukkan nilai baru untuk mengganti.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {loadError && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-[11.5px] text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {loadError}
        </p>
      )}
      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        <Icons.ShieldCheck size={13} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" />
        Semua API Key dienkripsi AES-256 di server sebelum disimpan. Nilai yang ditampilkan di sini sudah
        di-mask — key asli tidak pernah dikirim balik ke browser.
      </p>

      {keyField("geminiApiKey", "Gemini API Key", "AIzaSy...")}
      {keyField("googlePlacesApiKey", "Google Places API Key", "AIzaSy...")}
      {keyField("openaiApiKey", "OpenAI API Key (Opsional)", "sk-proj-...")}

      <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200">
          Custom LLM / Ollama Default Provider
        </h4>
        <div>
          <label className={labelClass}>Custom Base URL</label>
          <input
            type="text"
            placeholder="http://localhost:11434/v1"
            value={fields.customBaseUrl}
            onChange={(e) => setFields((f) => ({ ...f, customBaseUrl: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Custom Model Name</label>
          <input
            type="text"
            placeholder="llama3"
            value={fields.customModelName}
            onChange={(e) => setFields((f) => ({ ...f, customModelName: e.target.value }))}
            className={inputClass}
          />
        </div>
        {keyField("customApiKey", "Custom API Key (jika perlu)", "sk-...")}
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200">
          WhatsApp Cloud API (Meta — resmi)
        </h4>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Dipakai otomatis sama node &quot;Send WhatsApp Reply&quot; (provider = Meta) dan trigger
          &quot;WhatsApp Cloud API (Meta)&quot;. Ambil dari{" "}
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline">
            Meta App dashboard
          </a>{" "}
          &gt; WhatsApp &gt; API Setup.
        </p>
        {keyField("metaAccessToken", "Access Token (Temporary 24 jam / Permanent)", "EAAG...")}
        <div>
          <label className={labelClass}>Phone Number ID</label>
          <input
            type="text"
            placeholder="1234567890"
            value={fields.metaPhoneNumberId}
            onChange={(e) => setFields((f) => ({ ...f, metaPhoneNumberId: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>WABA ID (opsional)</label>
          <input
            type="text"
            placeholder="WhatsApp Business Account ID"
            value={fields.metaWabaId}
            onChange={(e) => setFields((f) => ({ ...f, metaWabaId: e.target.value }))}
            className={inputClass}
          />
        </div>
        {keyField("metaVerifyToken", "Verify Token (buat setup Callback URL)", "bikin string bebas sendiri")}
        <p className="text-[10.5px] leading-relaxed text-neutral-400">
          Pasang di Meta App dashboard &gt; WhatsApp &gt; Configuration:<br />
          Callback URL: <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">https://domain-lo/api/webhooks/whatsapp-meta</code><br />
          Verify Token: samain persis dengan yang lo isi di atas.
        </p>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200">
          WhatsApp Gateway (RapidAPI — legacy)
        </h4>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Buat yang masih pakai gateway pihak ketiga lewat RapidAPI (bukan Meta resmi). Dipakai otomatis sama
          node &quot;Send WhatsApp Reply&quot; (provider = RapidAPI) kalau field di node itu dikosongin.
        </p>
        {keyField("rapidApiKey", "X-RapidAPI-Key", "21621a6e6c...")}
        <div>
          <label className={labelClass}>X-RapidAPI-Host</label>
          <input
            type="text"
            placeholder="whatsapp-messaging-bot.p.rapidapi.com"
            value={fields.rapidApiHost}
            onChange={(e) => setFields((f) => ({ ...f, rapidApiHost: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Default Send-Message Endpoint URL</label>
          <input
            type="text"
            placeholder="https://whatsapp-messaging-bot.p.rapidapi.com/v1/sendText"
            value={fields.whatsappSendUrl}
            onChange={(e) => setFields((f) => ({ ...f, whatsappSendUrl: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200">
          Cloudinary (Media Upload)
        </h4>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Upload gambar/video dari WhatsApp ke Cloudinary — hasilnya URL publik buat posting sosmed.
          Daftar gratis di <a href="https://cloudinary.com" target="_blank" rel="noopener noreferrer" className="underline">cloudinary.com</a>.
        </p>
        <div>
          <label className={labelClass}>Cloud Name</label>
          <input
            type="text"
            placeholder="mycloud123"
            value={fields.cloudinaryCloudName}
            onChange={(e) => setFields((f) => ({ ...f, cloudinaryCloudName: e.target.value }))}
            className={inputClass}
          />
        </div>
        {keyField("cloudinaryApiKey", "API Key", "123456789")}
        {keyField("cloudinaryApiSecret", "API Secret", "xxxxxxxxxx")}
        <div>
          <label className={labelClass}>Default Folder</label>
          <input
            type="text"
            placeholder="zales-uploads"
            value={fields.cloudinaryFolder}
            onChange={(e) => setFields((f) => ({ ...f, cloudinaryFolder: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200">
          Supabase Storage (Alternatif Cloudinary)
        </h4>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          Upload file ke Supabase Storage — gratis 1 GB. Daftar di <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a>.
        </p>
        <div>
          <label className={labelClass}>Project URL</label>
          <input
            type="text"
            placeholder="https://xxx.supabase.co"
            value={fields.supabaseUrl}
            onChange={(e) => setFields((f) => ({ ...f, supabaseUrl: e.target.value }))}
            className={inputClass}
          />
        </div>
        {keyField("supabaseKey", "Anon / Service Key", "eyJhbGci...")}
        <div>
          <label className={labelClass}>Bucket Name</label>
          <input
            type="text"
            placeholder="media"
            value={fields.supabaseBucket}
            onChange={(e) => setFields((f) => ({ ...f, supabaseBucket: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11.5px] text-green-600 dark:text-green-400">{saved && "✓ Tersimpan"}</span>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {saving ? "Menyimpan..." : "Simpan API Key"}
        </button>
      </div>
      {saveError && <p className="text-[11.5px] text-red-500">{saveError}</p>}
    </div>
  );
}

// ───────────────────────────── Data Saya ─────────────────────────────

function DataTab() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/profile")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data?.id) throw new Error(data?.error || `Gagal load data (${r.status}).`);
        setProfile(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal load data."));
  }, []);

  const rows: [string, string][] = profile
    ? [
        ["Member sejak", new Date(profile.createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })],
        ["Login terakhir", profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString("id-ID") : "—"],
        ["Total login tercatat", String(profile.loginCount)],
        ["Jumlah workflow tersimpan", String(profile.workflowCount)],
        ["Metode login", profile.hasPassword ? "Email & Password" : "Google"],
      ]
    : [];

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        Transparansi data akun kamu — ditarik langsung dari database produksi, bukan angka contoh.
      </p>
      {error ? (
        <p className="text-[12px] text-red-500">{error}</p>
      ) : !profile ? (
        <p className="text-[12px] text-neutral-400">Memuat...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-100 dark:border-neutral-800">
          {rows.map(([k, v], i) => (
            <div
              key={k}
              className={`flex items-center justify-between px-3 py-2.5 text-[12px] ${
                i % 2 === 0 ? "bg-neutral-50 dark:bg-neutral-900/50" : "bg-white dark:bg-neutral-950"
              }`}
            >
              <span className="text-neutral-500 dark:text-neutral-400">{k}</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Bantuan ─────────────────────────────

function HelpTab() {
  const items = [
    {
      q: "Cara bikin workflow baru",
      a: "Klik tombol 'New' di toolbar, drag node dari sidebar kiri ke kanvas, lalu sambungkan antar node dengan menarik garis dari satu handle ke handle lainnya.",
    },
    {
      q: "Cara pakai AI Agentic",
      a: "Klik bubble AI bulat di pojok kiri bawah, pilih 'Sidebar AI Mode' untuk generate workflow tanpa meninggalkan kanvas, atau 'Fullscreen Mode' untuk tampilan penuh.",
    },
    {
      q: "Kenapa API key saya di-mask?",
      a: "Untuk keamanan, API key dienkripsi di server dan hanya ditampilkan sebagian (contoh: sk-a...9xyz). Masukkan key baru kalau mau menggantinya.",
    },
    {
      q: "Cara menjalankan workflow",
      a: "Klik tombol 'Run' di toolbar. Hasil eksekusi tiap node bisa dilihat di 'Run log' di bagian bawah kanvas.",
    },
  ];
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.q} className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-neutral-900 dark:text-neutral-100">
            <Icons.HelpCircle size={13} className="text-neutral-400" />
            {item.q}
          </p>
          <p className="text-[11.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">{item.a}</p>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Zona Bahaya ─────────────────────────────

function DangerTab({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menghapus akun.");
        setDeleting(false);
        return;
      }
      onClose();
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-red-700 dark:text-red-400">
          <Icons.TriangleAlert size={14} />
          Hapus Akun Secara Permanen
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-red-600/90 dark:text-red-400/80">
          Tindakan ini akan menghapus akun, seluruh workflow, dan API key tersimpan secara permanen dari
          server produksi. Tidak bisa dibatalkan.
        </p>
      </div>

      <form onSubmit={handleDelete} className="space-y-2.5">
        <div>
          <label className={labelClass}>Kata Sandi</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Kosongkan jika akun Google-only"
          />
        </div>
        <div>
          <label className={labelClass}>
            Ketik <span className="font-mono font-bold">DELETE</span> untuk konfirmasi
          </label>
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className={inputClass}
            placeholder="DELETE"
          />
        </div>
        {error && <p className="text-[11.5px] text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={deleting || confirmation !== "DELETE"}
          className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-40"
        >
          {deleting ? "Menghapus..." : "Hapus Akun Permanen"}
        </button>
      </form>
    </div>
  );
}
