"use client";

import { useState, useEffect } from "react";
import NodeSidebar from "@/components/sidebar/node-sidebar";
import FlowCanvas from "@/components/canvas/flow-canvas";
import InspectorPanel from "@/components/inspector/inspector-panel";
import Toolbar from "@/components/canvas/toolbar";
import RunLogDrawer from "@/components/canvas/run-log-drawer";
import FloatingAIBubble from "@/components/canvas/floating-ai-bubble";
import AgentBuilder from "@/components/agent-builder";
import { useZalesStore } from "@/store/zales-store";

export default function CanvasApp() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const theme = useZalesStore((s) => s.theme);
  const fetchUserSettings = useZalesStore((s) => s.fetchUserSettings);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    fetchUserSettings();
  }, [fetchUserSettings]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <Toolbar
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        onToggleLog={() => setLogOpen(!logOpen)}
      />
      <div className="flex min-h-0 flex-1">
        <NodeSidebar collapsed={sidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <FlowCanvas />
          </div>
          <RunLogDrawer open={logOpen} onClose={() => setLogOpen(false)} />
        </div>
        <InspectorPanel />

        {/* Sidebar AI Mode — opens alongside the canvas without navigating away (spec §2) */}
        {aiSidebarOpen && (
          <div className="w-[380px] shrink-0 border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            <AgentBuilder isSidebar onClose={() => setAiSidebarOpen(false)} />
          </div>
        )}
      </div>

      <FloatingAIBubble onOpenSidebarMode={() => setAiSidebarOpen(true)} />
    </div>
  );
}
