"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, getNodesByCategory } from "@/lib/node-registry";
import { NodeDefinition } from "@/types/zales";

const grouped = getNodesByCategory();

function onDragStart(e: React.DragEvent, kind: string) {
  e.dataTransfer.setData("application/zales-node", kind);
  e.dataTransfer.effectAllowed = "move";
}

function NodeEntry({ def }: { def: NodeDefinition }) {
  const IconComp = (Icons as unknown as Record<string, Icons.LucideIcon>)[def.icon] || Icons.Box;
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, def.kind)}
      className="flex cursor-grab items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-neutral-100 active:cursor-grabbing dark:hover:bg-neutral-800"
      title={def.description}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
        <IconComp size={13} strokeWidth={1.75} />
      </div>
      <span className="truncate text-[12.5px] text-neutral-700 dark:text-neutral-300">{def.label}</span>
    </div>
  );
}

function CategorySection({ category }: { category: string }) {
  const [open, setOpen] = useState(true);
  const defs = grouped[category] || [];
  if (defs.length === 0) return null;

  return (
    <div className="border-b border-neutral-100 py-1.5 last:border-0 dark:border-neutral-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-left"
      >
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {CATEGORY_LABELS[category]}
        </span>
        <Icons.ChevronDown
          size={13}
          className={`text-neutral-400 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 px-1">
          {defs.map((def) => (
            <NodeEntry key={def.kind} def={def} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NodeSidebar({ collapsed }: { collapsed: boolean }) {
  const [query, setQuery] = useState("");

  if (collapsed) return null;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = searching
    ? Object.values(grouped)
        .flat()
        .filter((def) => def.label.toLowerCase().includes(q) || def.description.toLowerCase().includes(q))
    : [];

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="border-b border-neutral-100 px-3.5 py-3 dark:border-neutral-800">
        <h2 className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">Nodes</h2>
        <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">Drag onto the canvas</p>
        <div className="relative mt-2.5">
          <Icons.Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari node..."
            className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pl-7 pr-2.5 text-[12px] text-neutral-800 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-500"
          />
        </div>
      </div>
      <div className="flex-1 px-1.5 py-1">
        {searching ? (
          matches.length > 0 ? (
            <div className="flex flex-col gap-0.5 px-1 py-1">
              {matches.map((def) => (
                <NodeEntry key={def.kind} def={def} />
              ))}
            </div>
          ) : (
            <p className="px-2.5 py-3 text-[11.5px] text-neutral-400">
              Gak ada node yang cocok dengan &quot;{query}&quot;.
            </p>
          )
        ) : (
          CATEGORY_ORDER.map((cat) => <CategorySection key={cat} category={cat} />)
        )}
      </div>
    </aside>
  );
}
