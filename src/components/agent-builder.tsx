"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";
import { useZalesStore } from "@/store/zales-store";
import { PROVIDER_PRESETS } from "@/lib/node-registry";
import { apiUrl } from "@/lib/api-base";

const EXAMPLES = [
  "Kalau ada pesan WhatsApp masuk yang mengandung kata 'konten', buatkan balasan otomatis pakai AI lalu kirim balik ke pengirimnya.",
  "Setiap ada pesan WhatsApp masuk, minta AI buatkan ide caption produk, lalu kirim caption itu balik ke pengirim.",
  "Buatkan laporan Excel dari data yang saya kirim manual, lalu kirim file-nya lewat WhatsApp ke nomor saya.",
];

const AGENT_BUILDER_CONFIG_KEY = "zales-agent-builder-config";

interface StoredAgentBuilderConfig {
  provider: string;
  baseUrl: string;
  model: string;
}

function loadStoredConfig(): StoredAgentBuilderConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AGENT_BUILDER_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.provider === "string" && typeof parsed?.baseUrl === "string" && typeof parsed?.model === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredConfig(cfg: StoredAgentBuilderConfig) {
  try {
    window.localStorage.setItem(AGENT_BUILDER_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // best-effort — localStorage may be unavailable (private mode, etc)
  }
}

export default function AgentBuilder({
  isSidebar = false,
  onClose,
}: {
  isSidebar?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  // Seed from whatever was saved last time (if anything) instead of always
  // hardcoding Ollama — this is what made the settings appear to "reset"
  // every time this panel was reopened.
  const initialStored = typeof window !== "undefined" ? loadStoredConfig() : null;
  const [provider, setProviderState] = useState(initialStored?.provider || "ollama");
  const [baseUrl, setBaseUrlState] = useState(initialStored?.baseUrl || PROVIDER_PRESETS.ollama.baseUrl);
  const [model, setModelState] = useState(initialStored?.model ?? (initialStored ? "" : "llama3:8b"));
  const [apiKey, setApiKey] = useState("");
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Tracks whether the user has actually touched provider/baseUrl/model in
  // this mount, so the prefill effect below only applies defaults on a real
  // provider switch — not every time userSettings refetches.
  const [hasHydrated, setHasHydrated] = useState(!!initialStored);

  const userSettings = useZalesStore((s) => s.userSettings);
  const fetchUserSettings = useZalesStore((s) => s.fetchUserSettings);

  useEffect(() => {
    fetchUserSettings();
  }, [fetchUserSettings]);

  function persist(next: Partial<StoredAgentBuilderConfig>) {
    const merged = { provider, baseUrl, model, ...next };
    saveStoredConfig(merged);
  }

  function setProvider(next: string) {
    setProviderState(next);
    saveStoredConfig({ provider: next, baseUrl, model });
  }
  function setBaseUrl(next: string) {
    setBaseUrlState(next);
    persist({ baseUrl: next });
  }
  function setModel(next: string) {
    setModelState(next);
    persist({ model: next });
  }

  // Prefill default configurations from account settings — but only when
  // the user actually switches provider in this session (hasHydrated guards
  // the very first render so a previously-saved custom model/baseUrl isn't
  // immediately stomped back to the hardcoded default on mount).
  useEffect(() => {
    if (!hasHydrated) {
      setHasHydrated(true);
      // Still resolve the API key field for whichever provider was restored.
      if (provider === "gemini") setApiKey(userSettings.geminiApiKey || "");
      else if (provider === "openai") setApiKey(userSettings.openaiApiKey || "");
      else if (provider === "custom") setApiKey(userSettings.customApiKey || "");
      else setApiKey("");
      setApiKeyTouched(false);
      return;
    }
    if (provider === "ollama") {
      setBaseUrlState(PROVIDER_PRESETS.ollama.baseUrl);
      setModelState("llama3:8b");
      setApiKey("");
      saveStoredConfig({ provider, baseUrl: PROVIDER_PRESETS.ollama.baseUrl, model: "llama3:8b" });
    } else if (provider === "gemini") {
      setBaseUrlState(PROVIDER_PRESETS.gemini.baseUrl);
      setModelState("gemini-2.5-flash");
      setApiKey(userSettings.geminiApiKey || "");
      saveStoredConfig({ provider, baseUrl: PROVIDER_PRESETS.gemini.baseUrl, model: "gemini-2.5-flash" });
    } else if (provider === "openai") {
      setBaseUrlState(PROVIDER_PRESETS.openai.baseUrl);
      setModelState("gpt-4o-mini");
      setApiKey(userSettings.openaiApiKey || "");
      saveStoredConfig({ provider, baseUrl: PROVIDER_PRESETS.openai.baseUrl, model: "gpt-4o-mini" });
    } else if (provider === "custom") {
      setBaseUrlState(userSettings.customBaseUrl || "");
      setModelState(userSettings.customModelName || "");
      setApiKey(userSettings.customApiKey || "");
      saveStoredConfig({ provider, baseUrl: userSettings.customBaseUrl || "", model: userSettings.customModelName || "" });
    }
    // Prefilled value is the masked display key from settings, not a real
    // key — mark untouched so handleGenerate knows to resolve it server-side.
    setApiKeyTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // Which encrypted settings field (if any) backs the current provider —
  // used so the server can decrypt+use the real stored key server-side
  // instead of trusting whatever masked string is shown in this input.
  function settingsFieldForProvider(): string | null {
    if (provider === "gemini") return "geminiApiKey";
    if (provider === "openai") return "openaiApiKey";
    if (provider === "custom") return "customApiKey";
    return null;
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const settingsField = settingsFieldForProvider();
      const useStoredKey = !apiKeyTouched && !!settingsField;
      const res = await fetch(apiUrl("/api/agent/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          baseUrl,
          model,
          apiKey: useStoredKey ? "" : apiKey,
          useStoredKey,
          settingsField,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal menyusun workflow.");
        return;
      }

      const saveRes = await fetch(apiUrl("/api/workflows"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: json.name, nodes: json.nodes, edges: json.edges }),
      });
      const saved = await saveRes.json();
      if (!saveRes.ok) {
        setError(saved.error || "Workflow tersusun tapi gagal disimpan ke server.");
        return;
      }

      useZalesStore.setState({
        nodes: json.nodes,
        edges: json.edges,
        currentWorkflowId: saved.id,
        currentWorkflowName: saved.name,
        selectedNodeId: null,
        runLog: [],
        isDirty: false,
      });
      
      if (json.note) setNote(json.note);
      
      if (!isSidebar) {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyusun workflow.");
    } finally {
      setLoading(false);
    }
  }

  // Sidebar Layout
  if (isSidebar) {
    return (
      <div className="flex h-full w-full flex-col bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 px-3.5 dark:border-neutral-800 bg-white dark:bg-neutral-950">
          <div className="flex items-center gap-1.5">
            <Icons.Sparkles size={14} className="text-neutral-900 dark:text-neutral-100" />
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              AI Agentic Builder
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <Icons.X size={15} />
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <p className="text-[12px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Tell the AI what automation you want in plain words. It will automatically construct the triggers, AI nodes, and integrations in your canvas.
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={EXAMPLES[0]}
            rows={4}
            className="w-full resize-none rounded-lg border border-neutral-200 bg-white p-2.5 text-[12.5px] text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />

          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] text-neutral-500 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 text-left line-clamp-1"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 space-y-2.5">
            <h4 className="text-[11.5px] font-bold text-neutral-700 dark:text-neutral-300">
              Model Configuration
            </h4>
            
            <div className="space-y-2">
              <div>
                <label className="mb-0.5 block text-[10px] text-neutral-400">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {Object.entries(PROVIDER_PRESETS).map(([value, p]) => (
                    <option key={value} value={value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-0.5 block text-[10px] text-neutral-400">Model Name</label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gemini-2.5-flash"
                  className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                />
              </div>

              {provider !== "ollama" && (
                <>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-neutral-400">API Endpoint</label>
                    <input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[10px] text-neutral-400">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setApiKeyTouched(true); }}
                      className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-[12px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-[11.5px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          {note && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              {note}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim() || !model.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 cursor-pointer"
          >
            {loading ? (
              <>
                <Icons.Loader2 size={13} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Icons.Wand2 size={13} /> Build Workflow
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Full Screen Layout (Default)
  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-white dark:bg-neutral-950">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950">
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Icons.ArrowLeft size={14} />
          Kembali ke Workspace
        </Link>
        <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
          Zales — AI Agentic Builder
        </span>
        <div className="w-32" />
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-2 flex items-center gap-2">
          <Icons.Sparkles size={18} className="text-neutral-900 dark:text-neutral-100" />
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            Ceritakan apa yang kamu mau otomatiskan
          </h1>
        </div>
        <p className="mb-5 text-[13px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Gak perlu tau cara drag-drop node. Tulis aja dalam bahasa biasa, nanti AI yang nyusun
          trigger, node AI, dan integrasinya otomatis di canvas — tinggal kamu cek & Run.
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={EXAMPLES[0]}
          rows={5}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white p-3 text-[13.5px] text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />

        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] text-neutral-500 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              {ex.length > 46 ? ex.slice(0, 46) + "…" : ex}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-[12.5px] font-semibold text-neutral-700 dark:text-neutral-300">
            Model AI yang dipakai buat nyusun workflow
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12.5px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              >
                {Object.entries(PROVIDER_PRESETS).map(([value, p]) => (
                  <option key={value} value={value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">Model Name</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gemini-2.0-flash"
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12.5px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">API Endpoint</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12.5px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-neutral-500 dark:text-neutral-400">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setApiKeyTouched(true); }}
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12.5px] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[12.5px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
        {note && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Catatan dari AI: {note}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim() || !model.trim()}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 cursor-pointer"
        >
          {loading ? (
            <>
              <Icons.Loader2 size={15} className="animate-spin" /> Menyusun workflow...
            </>
          ) : (
            <>
              <Icons.Wand2 size={15} /> Susun Workflow Otomatis
            </>
          )}
        </button>
        <p className="mt-2 text-center text-[11px] text-neutral-400 dark:text-neutral-600">
          Workflow langsung TERSIMPAN & AKTIF begitu selesai disusun — kalau ada node Schedule di
          dalamnya, dia beneran mulai jalan sendiri sesuai jadwalnya. Cek dulu di canvas & isi API
          key tiap node yang butuh sebelum jadwalnya kepencet.
        </p>
      </div>
    </div>
  );
}
