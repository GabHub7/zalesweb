"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import * as Icons from "lucide-react";

interface WorkflowSummary {
  id: string;
  name: string;
}

interface Conversation {
  id: string;
  workflow_id: string;
  title: string;
  updated_at: string;
}

interface AttachmentMeta {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments: AttachmentMeta[];
  created_at: string;
}

interface PendingFile {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  previewUrl: string | null;
  sizeBytes: number;
}

const MAX_FILE_MB = 15;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIconFor(mimeType: string, name: string): keyof typeof Icons {
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType === "application/pdf") return "FileText";
  if (mimeType === "application/zip" || name.toLowerCase().endsWith(".zip")) return "FileArchive";
  if (mimeType.startsWith("audio/")) return "FileAudio";
  if (mimeType.startsWith("video/")) return "FileVideo";
  return "File";
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

export default function ChatApp() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newChatWorkflowId, setNewChatWorkflowId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshWorkflows();
    refreshConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
    else setMessages([]);
  }, [activeConvId]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  async function refreshWorkflows() {
    try {
      const res = await fetch("/api/workflows", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setWorkflows(json);
        if (json.length > 0) setNewChatWorkflowId((prev) => prev || json[0].id);
      }
    } catch {
      // best-effort
    }
  }

  async function refreshConversations() {
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setConversations(json);
      }
    } catch {
      // best-effort
    }
  }

  async function loadMessages(conversationId: string) {
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, { credentials: "include" });
      const json = await res.json();
      if (res.ok) setMessages(json);
      else setError(json.error || "Gagal memuat riwayat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMessages(false);
      scrollToBottom();
    }
  }

  async function handleNewConversation() {
    if (!newChatWorkflowId) return;
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workflowId: newChatWorkflowId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal membuat percakapan baru.");
        return;
      }
      setConversations((prev) => [json, ...prev]);
      setActiveConvId(json.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDeleteConversation(id: string) {
    if (!confirm("Hapus percakapan ini beserta riwayatnya?")) return;
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: "DELETE", credentials: "include" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) setActiveConvId(null);
    } catch {
      // best-effort
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    for (const file of files) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`"${file.name}" lebih dari ${MAX_FILE_MB}MB — kompres dulu atau pecah jadi bagian lebih kecil.`);
        continue;
      }
      const dataBase64 = await fileToBase64(file);
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setPendingFiles((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64,
          previewUrl,
          sizeBytes: file.size,
        },
      ]);
    }
  }

  function removePendingFile(id: string) {
    setPendingFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function handleSend() {
    if (sending || !activeConvId) return;
    const trimmed = input.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    const optimisticMsg: ChatMessageRow = {
      id: `pending-${Math.random().toString(36).slice(2)}`,
      role: "user",
      text: trimmed,
      attachments: pendingFiles.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes })),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");
    const filesToSend = pendingFiles;
    setPendingFiles([]);
    setSending(true);
    setError(null);
    scrollToBottom();

    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: trimmed,
          files: filesToSend.map((f) => ({ name: f.name, mimeType: f.mimeType, dataBase64: f.dataBase64 })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || `Error ${res.status}`);
      } else {
        setMessages((prev) => [...prev, json.message]);
        refreshConversations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  return (
    <div className="flex h-dvh bg-white dark:bg-neutral-950">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-neutral-200 px-3 dark:border-neutral-800">
            <Link href="/" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800" title="Kembali ke canvas">
              <Icons.ArrowLeft size={15} />
            </Link>
            <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">Zales Chat</span>
          </div>

          <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
            <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">Workflow</label>
            <div className="flex gap-1.5">
              <select
                value={newChatWorkflowId}
                onChange={(e) => setNewChatWorkflowId(e.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-[12px] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {workflows.length === 0 && <option value="">Belum ada workflow</option>}
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleNewConversation}
                disabled={!newChatWorkflowId}
                title="Mulai percakapan baru"
                className="shrink-0 rounded-md bg-neutral-900 p-1.5 text-white disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900"
              >
                <Icons.Plus size={14} />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-neutral-400">
              Workflow harus punya node trigger &quot;Chat Box&quot; dan &quot;Balas ke Chat&quot;.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 && (
              <p className="px-2 py-4 text-center text-[11.5px] text-neutral-400">Belum ada percakapan.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`group mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[12.5px] ${
                  activeConvId === c.id
                    ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                }`}
              >
                <span className="truncate">{c.title}</span>
                <Icons.Trash2
                  size={13}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(c.id);
                  }}
                  className="shrink-0 text-neutral-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
                />
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Main chat panel */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title="Toggle sidebar"
            >
              <Icons.PanelLeft size={16} />
            </button>
            <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-neutral-900 p-0.5 text-white dark:bg-neutral-100 dark:text-neutral-900">
              <Image src="/logo.png" alt="Zales" width={20} height={20} className="rounded-md" />
            </div>
            <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
              {activeConv ? activeConv.title : "Pilih atau buat percakapan"}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Logout"
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Icons.LogOut size={16} />
          </button>
        </header>

        {!activeConvId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-neutral-400 dark:text-neutral-600">
            <Icons.MessageSquare size={28} />
            <p className="text-[13px]">Pilih workflow di kiri, lalu klik + untuk mulai percakapan baru.</p>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
              }}
            >
              <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
                {loadingMessages && (
                  <div className="flex justify-center py-8 text-neutral-400">
                    <Icons.Loader2 size={18} className="animate-spin" />
                  </div>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-24 text-center text-neutral-400 dark:text-neutral-600">
                    <Icons.Sparkles size={28} />
                    <p className="text-[13px]">Ngobrol bebas di sini — bisa lampirkan gambar, PDF, ZIP, atau file lainnya.</p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                          : "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                      }`}
                    >
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {m.attachments.map((f, i) => {
                            const Icon = Icons[fileIconFor(f.mimeType, f.name)] as React.ComponentType<{ size?: number }>;
                            return (
                              <div key={i} className="flex items-center gap-1 rounded-lg bg-black/10 px-2 py-1 text-[11px] dark:bg-white/10">
                                <Icon size={12} />
                                {f.name}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {m.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-neutral-100 px-3.5 py-2.5 text-[13px] text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500">
                      <Icons.Loader2 size={14} className="animate-spin" />
                    </div>
                  </div>
                )}
                {error && (
                  <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}
              </div>
              {dragOver && (
                <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center bg-neutral-900/40">
                  <div className="rounded-xl border-2 border-dashed border-white bg-neutral-900/80 px-6 py-4 text-[13px] font-medium text-white">
                    Lepas file di sini
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="mx-auto max-w-2xl">
                {pendingFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {pendingFiles.map((f) => {
                      const Icon = Icons[fileIconFor(f.mimeType, f.name)] as React.ComponentType<{ size?: number }>;
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                        >
                          {f.previewUrl ? (
                            <img src={f.previewUrl} alt={f.name} className="h-5 w-5 rounded object-cover" />
                          ) : (
                            <Icon size={12} />
                          )}
                          <span className="max-w-[140px] truncate">{f.name}</span>
                          <span className="text-neutral-400">{formatBytes(f.sizeBytes)}</span>
                          <button onClick={() => removePendingFile(f.id)} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                            <Icons.X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 focus-within:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-within:border-neutral-600">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-0.5 shrink-0 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    title="Lampirkan file"
                  >
                    <Icons.Paperclip size={16} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tulis pesan... (Shift+Enter untuk baris baru)"
                    rows={1}
                    className="max-h-40 flex-1 resize-none bg-transparent text-[13.5px] text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || (!input.trim() && pendingFiles.length === 0)}
                    className="mb-0.5 shrink-0 rounded-lg bg-neutral-900 p-2 text-white transition-colors hover:bg-neutral-700 disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    {sending ? <Icons.Loader2 size={15} className="animate-spin" /> : <Icons.ArrowUp size={15} />}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10.5px] text-neutral-400 dark:text-neutral-600">
                  Pesan diproses lewat workflow &quot;{activeConv?.title}&quot; &middot; Maks {MAX_FILE_MB}MB per file
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
