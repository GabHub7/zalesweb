"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import * as Icons from "lucide-react";
import { useZalesStore } from "@/store/zales-store";
import { executeWorkflow } from "@/lib/execution-engine";
import { RunLogEntry } from "@/types/zales";
import WorkflowsModal from "@/components/canvas/workflows-modal";
import SettingsModal from "@/components/canvas/settings-modal";
import RunHistoryPanel from "@/components/canvas/run-history-panel";

export default function Toolbar({
  onToggleSidebar,
  onToggleLog,
}: {
  onToggleSidebar: () => void;
  onToggleLog: () => void;
}) {
  const nodes = useZalesStore((s) => s.nodes);
  const edges = useZalesStore((s) => s.edges);
  const theme = useZalesStore((s) => s.theme);
  const toggleTheme = useZalesStore((s) => s.toggleTheme);
  const isRunning = useZalesStore((s) => s.isRunning);
  const setRunning = useZalesStore((s) => s.setRunning);
  const appendLog = useZalesStore((s) => s.appendLog);
  const clearLog = useZalesStore((s) => s.clearLog);
  const setNodeStatus = useZalesStore((s) => s.setNodeStatus);
  const currentWorkflowId = useZalesStore((s) => s.currentWorkflowId);
  const currentWorkflowName = useZalesStore((s) => s.currentWorkflowName);
  const setWorkflowName = useZalesStore((s) => s.setWorkflowName);
  const isDirty = useZalesStore((s) => s.isDirty);
  const isSaving = useZalesStore((s) => s.isSaving);
  const saveWorkflow = useZalesStore((s) => s.saveWorkflow);
  const resetWorkflow = useZalesStore((s) => s.resetWorkflow);

  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function handleRun() {
    clearLog();
    setRunning(true);
    const collected: RunLogEntry[] = [];
    const onLog = (entry: RunLogEntry) => {
      collected.push(entry);
      appendLog(entry);
    };
    let hadError = false;
    try {
      await executeWorkflow({ nodes, edges, onLog, onStatus: setNodeStatus });
    } catch (err) {
      hadError = true;
      onLog({
        id: Math.random().toString(36).slice(2),
        nodeId: "workflow",
        nodeLabel: "Workflow",
        status: "error",
        timestamp: Date.now(),
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRunning(false);
      if (currentWorkflowId) {
        fetch(`/api/workflows/${currentWorkflowId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: hadError ? "error" : "success",
            log: collected,
          }),
        }).catch(() => {});
      }
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-3 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <Icons.PanelLeft size={16} />
        </button>
        <div className="ml-1 flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-neutral-900 dark:bg-neutral-100 p-0.5 text-white dark:text-neutral-900">
            <Image src="/logo.png" alt="Zales" width={20} height={20} className="rounded-md" />
          </div>
          <span className="text-[13.5px] font-semibold text-neutral-900 dark:text-neutral-100">Zales</span>
        </div>
        <div className="mx-2 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <input
          value={currentWorkflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="w-44 truncate bg-transparent text-[12.5px] text-neutral-600 outline-none focus:text-neutral-900 dark:text-neutral-400 dark:focus:text-neutral-100"
        />
        {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />}
      </div>

      <div className="flex items-center gap-1.5">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Icons.Sparkles size={13} />
          Chat AI
        </Link>
        <Link
          href="/api-keys"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Icons.KeyRound size={13} />
          API Keys
        </Link>
        <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <button
          onClick={resetWorkflow}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          New
        </button>
        <button
          onClick={() => setShowWorkflows(true)}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Open
        </button>
        <button
          onClick={() => saveWorkflow()}
          disabled={isSaving || nodes.length === 0}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {isSaving ? <Icons.Loader2 size={13} className="animate-spin" /> : <Icons.Save size={13} />}
          Save
        </button>

        <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <button
          onClick={onToggleLog}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Run log
        </button>
        <button
          onClick={() => setShowHistory(true)}
          disabled={!currentWorkflowId}
          className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Riwayat
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          title="Settings"
        >
          <Icons.Settings size={16} />
        </button>
        <button
          onClick={toggleTheme}
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          {theme === "dark" ? <Icons.Sun size={16} /> : <Icons.Moon size={16} />}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Logout"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <Icons.LogOut size={16} />
        </button>
        <button
          onClick={handleRun}
          disabled={isRunning || nodes.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {isRunning ? (
            <Icons.Loader2 size={13} className="animate-spin" />
          ) : (
            <Icons.Play size={13} />
          )}
          {isRunning ? "Running..." : "Run"}
        </button>
      </div>

      {showWorkflows && <WorkflowsModal onClose={() => setShowWorkflows(false)} />}
      {showHistory && currentWorkflowId && (
        <RunHistoryPanel workflowId={currentWorkflowId} onClose={() => setShowHistory(false)} />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
}
