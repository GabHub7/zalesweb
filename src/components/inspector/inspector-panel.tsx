"use client";

import { useState, useMemo } from "react";
import * as Icons from "lucide-react";
import { useZalesStore } from "@/store/zales-store";
import { NODE_REGISTRY, PROVIDER_PRESETS } from "@/lib/node-registry";
import { NodeParamSchema, ZalesNode, RunLogEntry } from "@/types/zales";
import { executeWorkflow } from "@/lib/execution-engine";

// Maps node param keys to account settings keys — used to show "from account" hints
const ACCOUNT_FALLBACK_MAP: Record<string, string> = {
  apiKey: "openaiApiKey",
  geminiApiKey: "geminiApiKey",
  supabaseUrl: "supabaseUrl",
  supabaseKey: "supabaseKey",
  bucket: "supabaseBucket",
  cloudName: "cloudinaryCloudName",
  rapidApiKey: "rapidApiKey",
};

function WebhookUrlBox({ kind }: { kind: string }) {
  const nodes = useZalesStore((s) => s.nodes);
  const selectedNodeId = useZalesStore((s) => s.selectedNodeId);
  const node = nodes.find((n) => n.id === selectedNodeId);
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let url: string;
  if (kind === "trigger.whatsapp_gateway") {
    url = `${origin}/api/webhooks/gateway`;
  } else {
    const rawPath = (node.data.params.path as string) || "/webhook/my-flow";
    const normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    url = `${origin}/api/webhooks/custom${normalized}`;
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/20">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
        <Icons.Link size={12} />
        {kind === "trigger.whatsapp_gateway"
          ? "URL ini yang dipasang di dashboard RapidAPI / WA gateway kamu"
          : "URL yang manggil workflow ini dari luar"}
      </p>
      <div className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-[10.5px] text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {url}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[10.5px] font-medium text-white hover:bg-blue-700"
        >
          {copied ? "Tersalin!" : "Copy"}
        </button>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-relaxed text-blue-600/80 dark:text-blue-400/70">
        {kind === "trigger.whatsapp_gateway"
          ? "Method: POST. Set gateway/RapidAPI-nya buat POST payload pesan masuk ke URL ini — bukan Zales yang manggil RapidAPI, RapidAPI yang manggil Zales."
          : "Kirim request (method sesuai yang dipilih di bawah) ke URL ini buat trigger workflow — sesuaikan Path & Method dulu, baru copy URL-nya."}
        {" "}Kalau env <code>WEBHOOK_VERIFY_TOKEN</code> di-set, sertakan header <code>x-webhook-token</code>.
      </p>
    </div>
  );
}

function ToolAttachmentField({
  candidates,
  selected,
  onChange,
}: {
  candidates: ZalesNode[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (candidates.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-neutral-200 px-2.5 py-2 text-[11.5px] text-neutral-400 dark:border-neutral-700">
        Belum ada node lain di kanvas ini buat dijadiin tool. Tambah node (MCP Connector, HTTP Request, AI Agent
        lain, dll) lalu pilih di sini.
      </p>
    );
  }
  return (
    <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-neutral-200 p-1.5 dark:border-neutral-700">
      {candidates.map((c) => {
        const checked = selected.includes(c.id);
        return (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(checked ? selected.filter((id) => id !== c.id) : [...selected, c.id])
              }
              className="accent-neutral-900 dark:accent-neutral-100"
            />
            <span className="truncate">{c.data.label}</span>
            <span className="ml-auto shrink-0 text-[10px] text-neutral-400">{c.data.kind}</span>
          </label>
        );
      })}
    </div>
  );
}

function Field({
  schema,
  value,
  onChange,
  accountHint,
}: {
  schema: NodeParamSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  accountHint?: string;
}) {
  const baseInput =
    "w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12.5px] text-neutral-900 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500";

  const hasValue = value !== undefined && value !== null && value !== "";
  const placeholder = accountHint && !hasValue
    ? `${schema.placeholder || ""} (tersimpan di Akun)`
    : schema.placeholder;

  if (schema.type === "textarea" || schema.type === "code") {
    return (
      <div>
        <textarea
          className={`${baseInput} min-h-[84px] resize-y font-mono text-[12px] leading-relaxed`}
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        {accountHint && !hasValue && (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-green-600 dark:text-green-400">
            <Icons.Check size={10} />
            Akan pakai dari Pengaturan Akun
          </p>
        )}
      </div>
    );
  }

  if (schema.type === "select") {
    return (
      <select
        className={baseInput}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {schema.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (schema.type === "slider") {
    return (
      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min={schema.min}
          max={schema.max}
          step={schema.step ?? 1}
          value={(value as number) ?? schema.min ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900 dark:bg-neutral-700 dark:accent-neutral-100"
        />
        <span className="w-10 shrink-0 text-right text-[11.5px] tabular-nums text-neutral-500 dark:text-neutral-400">
          {value as number}
        </span>
      </div>
    );
  }

  if (schema.type === "password") {
    return (
      <div>
        <input
          type="password"
          className={baseInput}
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {accountHint && !hasValue && (
          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-green-600 dark:text-green-400">
            <Icons.Check size={10} />
            Akan pakai dari Pengaturan Akun
          </p>
        )}
      </div>
    );
  }

  if (schema.type === "number") {
    return (
      <input
        type="number"
        min={schema.min}
        max={schema.max}
        className={baseInput}
        placeholder={placeholder}
        value={(value as number) ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : parseFloat(e.target.value))}
      />
    );
  }

  return (
    <div>
      <input
        type="text"
        className={baseInput}
        placeholder={placeholder}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {accountHint && !hasValue && (
        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-green-600 dark:text-green-400">
          <Icons.Check size={10} />
          Akan pakai dari Pengaturan Akun
        </p>
      )}
    </div>
  );
}

function WhatsAppSimulator() {
  const nodes = useZalesStore((s) => s.nodes);
  const edges = useZalesStore((s) => s.edges);
  const appendLog = useZalesStore((s) => s.appendLog);

  const [from, setFrom] = useState("6281234567890");
  const [text, setText] = useState("Halo, mau tanya soal produk kalian");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSimulate() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/workflows/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
          triggerData: { from, text, raw: { from, message: text, simulated: true } },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Server returned ${res.status}`);
      (json.log as RunLogEntry[]).forEach((entry) => appendLog(entry));
      setResult({
        ok: json.ok,
        message: json.ok
          ? "Selesai — cek Run Log di bawah kanvas buat lihat balesan tiap node."
          : "Ada node yang error — cek Run Log buat detailnya.",
      });
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
        <Icons.PlayCircle size={12} />
        Simulasiin pesan WA masuk
      </p>
      <p className="mb-2 text-[10.5px] leading-relaxed text-neutral-400">
        Jalanin SELURUH workflow (trigger → AI Agent → balesan) pakai data palsu — tanpa perlu nunggu pesan asli
        dari WhatsApp. Berguna buat mastiin AI Agent & node balasan udah nyambung bener.
      </p>
      <div className="space-y-1.5">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Nomor pengirim (from)"
          className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Isi pesan"
          className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-[12px] text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
      <button
        onClick={handleSimulate}
        disabled={running}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-neutral-900 py-1.5 text-[11.5px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {running ? "Menjalankan..." : "Simulasikan & Jalankan Workflow"}
      </button>
      {result && (
        <p className={`mt-1.5 text-[10.5px] ${result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}

export default function InspectorPanel() {
  const selectedNodeId = useZalesStore((s) => s.selectedNodeId);
  const nodes = useZalesStore((s) => s.nodes);
  const updateNodeParam = useZalesStore((s) => s.updateNodeParam);
  const updateNodeLabel = useZalesStore((s) => s.updateNodeLabel);
  const selectNode = useZalesStore((s) => s.selectNode);
  const setNodeStatus = useZalesStore((s) => s.setNodeStatus);
  const appendLog = useZalesStore((s) => s.appendLog);
  const userSettings = useZalesStore((s) => s.userSettings);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) return null;

  const def = NODE_REGISTRY[node.data.kind];
  const toolCandidates = nodes.filter(
    (n) => n.id !== node.id && !n.data.kind.startsWith("trigger.")
  );

  async function handleTest() {
    if (!node) return;
    setTesting(true);
    setTestResult(null);
    try {
      await executeWorkflow({
        nodes: [node],
        edges: [],
        onLog: appendLog,
        onStatus: setNodeStatus,
      });
      setTestResult({ ok: true, message: "Node ran successfully." });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="min-w-0">
          <input
            value={node.data.label}
            onChange={(e) => updateNodeLabel(node.id, e.target.value)}
            className="w-full truncate bg-transparent text-[13px] font-semibold text-neutral-900 outline-none dark:text-neutral-100"
          />
          <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">{def?.description}</p>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="ml-2 shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <Icons.X size={15} />
        </button>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        {(node.data.kind === "trigger.whatsapp_gateway" || node.data.kind === "trigger.webhook") && (
          <WebhookUrlBox kind={node.data.kind} />
        )}
        {node.data.kind === "trigger.whatsapp_gateway" && <WhatsAppSimulator />}
        {def?.params.length === 0 && (
          <p className="text-[12px] text-neutral-400 dark:text-neutral-500">
            This node has no configurable parameters.
          </p>
        )}
        {def?.params.map((schema) => {
          const accountKey = ACCOUNT_FALLBACK_MAP[schema.key];
          const accountHint = accountKey && userSettings[accountKey] ? userSettings[accountKey].slice(0, 20) + "..." : undefined;
          return (
            <div key={schema.key}>
              <label className="mb-1.5 block text-[11.5px] font-medium text-neutral-600 dark:text-neutral-400">
                {schema.label}
              </label>
              {schema.type === "node_multiselect" ? (
                <ToolAttachmentField
                  candidates={toolCandidates}
                  selected={(node.data.params[schema.key] as string[]) || []}
                  onChange={(ids) => updateNodeParam(node.id, schema.key, ids)}
                />
              ) : (
                <Field
                  schema={schema}
                  value={node.data.params[schema.key]}
                  accountHint={accountKey && userSettings[accountKey] ? accountHint : undefined}
                  onChange={(v) => {
                    updateNodeParam(node.id, schema.key, v);
                    if (schema.key === "provider" && typeof v === "string" && v !== "custom") {
                      const preset = PROVIDER_PRESETS[v];
                      if (preset) updateNodeParam(node.id, "baseUrl", preset.baseUrl);
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {testing ? (
            <Icons.Loader2 size={13} className="animate-spin" />
          ) : (
            <Icons.PlayCircle size={13} />
          )}
          {testing ? "Testing..." : "Test node"}
        </button>
        {testResult && (
          <div
            className={`mt-2 rounded-md border px-2.5 py-2 text-[11.5px] leading-relaxed ${
              testResult.ok
                ? "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
                : "border-neutral-300 bg-neutral-50 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200"
            }`}
          >
            {testResult.message}
          </div>
        )}
      </div>
    </aside>
  );
}
