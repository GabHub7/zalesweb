"use client";

import * as Icons from "lucide-react";
import { useZalesStore } from "@/store/zales-store";

export default function RunLogDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const runLog = useZalesStore((s) => s.runLog);
  const clearLog = useZalesStore((s) => s.clearLog);

  if (!open) return null;

  return (
    <div className="flex h-56 shrink-0 flex-col border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 dark:border-neutral-800">
        <span className="text-[12px] font-medium text-neutral-600 dark:text-neutral-400">
          Run log {runLog.length > 0 && `(${runLog.length})`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={clearLog}
            className="rounded-md px-2 py-1 text-[11.5px] text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Icons.X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[11.5px]">
        {runLog.length === 0 && (
          <p className="py-6 text-center text-neutral-400 dark:text-neutral-600">
            No runs yet. Click Run to execute the workflow.
          </p>
        )}
        {runLog.map((entry) => {
          const output = entry.output as
            | { imageDataUrl?: string; fileBase64?: string; fileName?: string; mimeType?: string }
            | undefined;
          const imagePreview = output?.imageDataUrl;
          const fileDownload =
            output?.fileBase64 && output?.mimeType
              ? { href: `data:${output.mimeType};base64,${output.fileBase64}`, name: output.fileName || "file" }
              : null;
          return (
            <div
              key={entry.id}
              className="flex items-start gap-2 border-b border-neutral-50 py-1.5 dark:border-neutral-900"
            >
              <span
                className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  entry.status === "success"
                    ? "bg-neutral-900 dark:bg-neutral-100"
                    : "border border-neutral-400 bg-white dark:bg-neutral-900"
                }`}
              />
              <span className="w-32 shrink-0 truncate text-neutral-500 dark:text-neutral-400">
                {entry.nodeLabel}
              </span>
              <span className="w-14 shrink-0 text-neutral-400 dark:text-neutral-600">
                {entry.durationMs ? `${Math.round(entry.durationMs)}ms` : ""}
              </span>
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Generated preview"
                  className="h-8 w-8 shrink-0 rounded border border-neutral-200 object-cover dark:border-neutral-800"
                />
              )}
              {fileDownload && (
                <a
                  href={fileDownload.href}
                  download={fileDownload.name}
                  className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10.5px] text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  ⬇ {fileDownload.name}
                </a>
              )}
              <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                {entry.error ? entry.error : JSON.stringify(entry.output)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
