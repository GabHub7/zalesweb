"use client";

import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowInstance,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useZalesStore } from "@/store/zales-store";
import ZalesNodeComponent from "@/components/nodes/zales-node";
import NodeSearchMenu from "@/components/canvas/node-search-menu";
import { NodeKind } from "@/types/zales";

const nodeTypes = { zalesNode: ZalesNodeComponent };

function FlowCanvasInner() {
  const nodes = useZalesStore((s) => s.nodes);
  const edges = useZalesStore((s) => s.edges);
  const onNodesChange = useZalesStore((s) => s.onNodesChange);
  const onEdgesChange = useZalesStore((s) => s.onEdgesChange);
  const onConnect = useZalesStore((s) => s.onConnect);
  const addNode = useZalesStore((s) => s.addNode);
  const selectNode = useZalesStore((s) => s.selectNode);
  const theme = useZalesStore((s) => s.theme);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(
    null
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/zales-node") as NodeKind;
      if (!kind || !rfInstance) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const position = rfInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      addNode(kind, position);
    },
    [rfInstance, addNode]
  );

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      if (!rfInstance) return;
      const flowPos = rfInstance.screenToFlowPosition({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY });
      setMenu({ x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY, flowX: flowPos.x, flowY: flowPos.y });
    },
    [rfInstance]
  );

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full bg-white dark:bg-[#0a0a0a]"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        nodeTypes={nodeTypes}
        onPaneClick={() => selectNode(null)}
        onPaneContextMenu={onPaneContextMenu}
        colorMode={theme}
        defaultEdgeOptions={{
          style: { stroke: theme === "dark" ? "#525252" : "#a3a3a3", strokeWidth: 1.5 },
          type: "smoothstep",
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.1}
          color={theme === "dark" ? "#2a2a2a" : "#e5e5e5"}
        />
        <Controls
          showInteractive={false}
          className="!border !border-neutral-200 !bg-white !shadow-sm dark:!border-neutral-700 dark:!bg-neutral-900 [&>button]:!border-neutral-200 [&>button]:!bg-white [&>button]:!text-neutral-600 dark:[&>button]:!border-neutral-700 dark:[&>button]:!bg-neutral-900 dark:[&>button]:!text-neutral-300"
        />
      </ReactFlow>

      {menu && (
        <NodeSearchMenu
          position={{ x: menu.x, y: menu.y }}
          onSelect={(kind) => {
            addNode(kind, { x: menu.flowX, y: menu.flowY });
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
