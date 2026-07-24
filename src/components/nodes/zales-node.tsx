"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { ZalesNodeData } from "@/types/zales";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { useZalesStore } from "@/store/zales-store";

function StatusDot({ status }: { status: ZalesNodeData["status"] }) {
  if (status === "running") {
    return (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neutral-400 opacity-75 dark:bg-neutral-500" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-500 dark:bg-neutral-400" />
      </span>
    );
  }
  if (status === "success") {
    return <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-neutral-100" />;
  }
  if (status === "error") {
    return <span className="h-2 w-2 rounded-full border border-neutral-900 bg-white dark:border-neutral-100 dark:bg-neutral-900" style={{ boxShadow: "inset 0 0 0 2px transparent" }} />;
  }
  return <span className="h-2 w-2 rounded-full border border-dashed border-neutral-400 dark:border-neutral-600" />;
}

function ZalesNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ZalesNodeData;
  const def = NODE_REGISTRY[nodeData.kind];
  const selectNode = useZalesStore((s) => s.selectNode);
  const removeNode = useZalesStore((s) => s.removeNode);

  const IconComp = (Icons as unknown as Record<string, Icons.LucideIcon>)[def?.icon] || Icons.Box;

  return (
    <div
      onClick={() => selectNode(id)}
      className={`group relative w-56 rounded-lg border bg-white shadow-sm transition-shadow dark:bg-neutral-900 ${
        selected
          ? "border-neutral-900 shadow-md dark:border-neutral-100"
          : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
      }`}
    >
      {def?.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-neutral-400 !bg-white dark:!border-neutral-500 dark:!bg-neutral-900"
        />
      )}

      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <IconComp size={15} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
            {nodeData.label}
          </p>
          <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
            {def?.label}
          </p>
        </div>
        <StatusDot status={nodeData.status} />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          removeNode(id);
        }}
        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 opacity-0 shadow-sm transition-opacity hover:text-neutral-700 group-hover:opacity-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:text-neutral-200"
      >
        <Icons.X size={11} />
      </button>

      {def?.hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-neutral-400 !bg-white dark:!border-neutral-500 dark:!bg-neutral-900"
        />
      )}
    </div>
  );
}

export default memo(ZalesNodeComponent);
