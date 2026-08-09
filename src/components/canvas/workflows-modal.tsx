"use client";

import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { useZalesStore } from "@/store/zales-store";
import { apiUrl } from "@/lib/api-base";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

export default function WorkflowsModal({ onClose }: { onClose: () => void }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadWorkflow = useZalesStore((s) => s.loadWorkflow);

  useEffect(() => {
    fetch(apiUrl("/api/workflows"), { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
        return res.json();
      })
      .then(setWorkflows)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleOpen(id: string) {
    try {
      const res = await fetch(apiUrl(`/api/workflows/${id}`), { credentials: "include" });
      if (!res.ok) {
        setError("Failed to load workflow.");
        return;
      }
      const wf = await res.json();
      loadWorkflow(wf.id, wf.name, wf.nodes, wf.edges);
      onClose();
    } catch {
      setError("Failed to load workflow.");
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this workflow? This cannot be undone.")) return;
    try {
      const res = await fetch(apiUrl(`/api/workflows/${id}`), { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setWorkflows((prev) => prev.filter((w) => w.id !== id));
      } else {
        setError("Failed to delete workflow.");
      }
    } catch {
      setError("Failed to delete workflow.");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <span className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            My Workflows
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Icons.X size={15} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-1.5">
          {loading && (
            <p className="py-8 text-center text-[12px] text-neutral-400">Loading...</p>
          )}
          {error && (
            <p className="px-3 py-4 text-[12px] text-red-500 dark:text-red-400">
              {error}
            </p>
          )}
          {!loading && !error && workflows.length === 0 && (
            <p className="py-8 text-center text-[12px] text-neutral-400">
              No saved workflows yet. Build something and hit Save.
            </p>
          )}
          {workflows.map((wf) => (
            <button
              key={wf.id}
              onClick={() => handleOpen(wf.id)}
              className="group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200">
                  {wf.name}
                </p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  Updated {new Date(wf.updated_at).toLocaleString()}
                </p>
              </div>
              <span
                onClick={(e) => handleDelete(wf.id, e)}
                className="shrink-0 rounded-md p-1.5 text-neutral-300 opacity-0 hover:bg-neutral-200 hover:text-neutral-600 group-hover:opacity-100 dark:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
              >
                <Icons.Trash2 size={13} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
