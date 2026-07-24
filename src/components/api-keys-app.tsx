"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import * as Icons from "lucide-react";

interface WorkflowSummary {
  id: string;
  name: string;
}

interface ApiKeyRow {
  id: string;
  workflow_id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Belum pernah dipakai";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function ApiKeysApp() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ plaintextKey: string; workflowName: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    refreshWorkflows();
    refreshKeys();
  }, []);

  async function refreshWorkflows() {
    try {
      const res = await fetch("/api/workflows", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setWorkflows(json);
        if (json.length > 0) setSelectedWorkflowId((prev) => prev || json[0].id);
      }
    } catch {
      // best-effort
    }
  }

  async function refreshKeys() {
    try {
      const res = await fetch("/api/api-keys", { credentials: "include" });
      if (res.ok) setKeys(await res.json());
    } catch {
      // best-effort
    }
  }

  async function handleCreate() {
    if (!selectedWorkflowId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workflowId: selectedWorkflowId, name: keyName || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal membuat API key.");
        return;
      }
      const workflowName = workflows.find((w) => w.id === selectedWorkflowId)?.name || "workflow";
      setRevealedKey({ plaintextKey: json.plaintextKey, workflowName });
      setKeyName("");
      refreshKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus API key ini? Aplikasi yang masih memakainya akan langsung berhenti bisa memicu workflow.")) return;
    try {
      await fetch(`/api/api-keys/${id}`, { method: "DELETE", credentials: "include" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // best-effort
    }
  }

  function copyKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.plaintextKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-[12.5px] text-neutral-800 outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-600";
  const labelClass = "mb-1 block text-[11.5px] font-semibold text-neutral-600 dark:text-neutral-400";

  return (
    <div className="min-h-dvh bg-white dark:bg-neutral-950">
      <header className="flex h-12 items-center justify-between border-b border-neutral-200 px-3 dark:border-neutral-800">
        <div className="flex items-center gap-1.5">
          <Link href="/" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Kembali ke canvas">
            <Icons.ArrowLeft size={16} />
          </Link>
          <div className="ml-1 flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-neutral-900 p-0.5 text-white dark:bg-neutral-100 dark:text-neutral-900">
              <Image src="/logo.png" alt="Zales" width={20} height={20} className="rounded-md" />
            </div>
            <span className="text-[13.5px] font-semibold text-neutral-900 dark:text-neutral-100">API Keys</span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Logout"
        >
          <Icons.LogOut size={16} />
        </button>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 text-[16px] font-semibold text-neutral-900 dark:text-neutral-100">API Keys Eksternal</h1>
        <p className="mb-6 text-[12.5px] leading-relaxed text-neutral-500 dark:text-neutral-400">
          Generate API key buat memicu workflow tertentu dari luar Zales — aplikasi lain, server sendiri, curl, Zapier/Make,
          dll. Satu key cuma bisa memicu 1 workflow yang dipilih saat dibuat.
        </p>

        {/* Create new key */}
        <div className="mb-8 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-3 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">Buat API Key Baru</h2>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Workflow</label>
              <select value={selectedWorkflowId} onChange={(e) => setSelectedWorkflowId(e.target.value)} className={inputClass}>
                {workflows.length === 0 && <option value="">Belum ada workflow</option>}
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Nama Key (opsional, buat penanda)</label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="mis. Integrasi Aplikasi Kasir"
                className={inputClass}
              />
            </div>
            {error && <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={creating || !selectedWorkflowId}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {creating ? "Membuat..." : "Generate API Key"}
            </button>
          </div>
        </div>

        {/* One-time reveal of a freshly created key */}
        {revealedKey && (
          <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800 dark:text-amber-300">
              <Icons.TriangleAlert size={14} />
              Simpan sekarang — key ini cuma ditampilkan sekali
            </div>
            <p className="mb-2 text-[11.5px] text-amber-700 dark:text-amber-400">
              API key untuk workflow &quot;{revealedKey.workflowName}&quot;. Setelah lo tutup halaman ini, key-nya gak bisa
              dilihat lagi (cuma bisa dihapus dan bikin baru).
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md bg-white px-2.5 py-1.5 text-[11.5px] dark:bg-neutral-900">
                {revealedKey.plaintextKey}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 rounded-md bg-neutral-900 px-2.5 py-1.5 text-[11.5px] font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
              >
                {copied ? "Tersalin!" : "Salin"}
              </button>
            </div>
            <div className="mt-3 rounded-md bg-white/60 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-black/20 dark:text-amber-300">
              Cara pakai:
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">
{`curl -X POST https://<domain-lo>/api/external/run \\
  -H "Authorization: Bearer ${revealedKey.plaintextKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "halo"}'`}
              </pre>
            </div>
            <button onClick={() => setRevealedKey(null)} className="mt-2 text-[11px] text-amber-700 underline dark:text-amber-400">
              Tutup
            </button>
          </div>
        )}

        {/* Existing keys */}
        <h2 className="mb-3 text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">Key Aktif</h2>
        {keys.length === 0 ? (
          <p className="text-[12px] text-neutral-400">Belum ada API key.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => {
              const workflowName = workflows.find((w) => w.id === k.workflow_id)?.name || k.workflow_id;
              return (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
                >
                  <div>
                    <div className="text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200">{k.name}</div>
                    <div className="text-[11px] text-neutral-400">
                      <code>{k.key_prefix}...</code> &middot; workflow: {workflowName} &middot; terakhir dipakai:{" "}
                      {formatDate(k.last_used_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="shrink-0 rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    title="Hapus key"
                  >
                    <Icons.Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
