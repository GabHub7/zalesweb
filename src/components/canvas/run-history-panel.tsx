"use client";

import { useEffect, useState } from "react";
import * as Icons from "lucide-react";

interface RunLogEntry {
  id: string;
  nodeId: string;
  nodeLabel: string;
  status: string;
  timestamp: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

interface RunRow {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  log: RunLogEntry[];
}

export default function RunHistoryPanel({ workflowId, onClose }: { workflowId: string; onClose: () => void }) {
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/workflows/${workflowId}/runs`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setRuns(data) : setError("Gagal load riwayat.")))
      .catch(() => setError("Gagal load riwayat."));
  }, [workflowId]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[560px] w-[560px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <div className="flex items-center gap-1.5">
            <Icons.History size={14} className="text-neutral-700 dark:text-neutral-300" />
            <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
              Riwayat Eksekusi
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Icons.X size={15} />
          </button>
        </div>

        <p className="border-b border-neutral-100 px-4 py-2 text-[11px] leading-relaxed text-neutral-400 dark:border-neutral-800">
          Termasuk run yang dipicu dari luar (webhook RapidAPI/WhatsApp, jadwal, dll) — bukan cuma yang kamu klik
          &quot;Run&quot; manual. Buka salah satu, expand node trigger-nya buat lihat payload mentah yang beneran
          masuk.
        </p>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {error && <p className="px-2 py-4 text-[12px] text-red-500">{error}</p>}
          {!runs && !error && <p className="px-2 py-4 text-[12px] text-neutral-400">Memuat...</p>}
          {runs && runs.length === 0 && (
            <p className="px-2 py-4 text-[12px] text-neutral-400">
              Belum ada run tercatat. Coba trigger dari webhook/WA, atau klik &quot;Run&quot;.
            </p>
          )}
          {runs?.map((run) => (
            <div key={run.id} className="mb-1.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      run.status === "success" ? "bg-green-500" : run.status === "error" ? "bg-red-500" : "bg-neutral-400"
                    }`}
                  />
                  <span className="text-[12px] text-neutral-700 dark:text-neutral-300">
                    {new Date(run.started_at).toLocaleString("id-ID")}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[10.5px] text-neutral-400">
                  {run.log?.length ?? 0} node
                  <Icons.ChevronDown
                    size={13}
                    className={`transition-transform ${expandedRun === run.id ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
              {expandedRun === run.id && (
                <div className="space-y-1 border-t border-neutral-100 px-3 py-2 dark:border-neutral-800">
                  {(run.log || []).map((entry) => {
                    const entryKey = `${run.id}-${entry.id}`;
                    return (
                      <div key={entryKey} className="rounded-md bg-neutral-50 dark:bg-neutral-900/60">
                        <button
                          onClick={() => setExpandedEntry(expandedEntry === entryKey ? null : entryKey)}
                          className="flex w-full items-center justify-between px-2.5 py-1.5 text-left"
                        >
                          <span className="text-[11.5px] font-medium text-neutral-700 dark:text-neutral-300">
                            {entry.nodeLabel}
                          </span>
                          <span
                            className={`text-[10px] ${
                              entry.status === "error" ? "text-red-500" : "text-neutral-400"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </button>
                        {expandedEntry === entryKey && (
                          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all border-t border-neutral-100 px-2.5 py-2 text-[10.5px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                            {entry.error || JSON.stringify(entry.output ?? entry.input, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
