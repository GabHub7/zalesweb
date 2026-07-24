"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import * as Icons from "lucide-react";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { NodeKind } from "@/types/zales";

export default function NodeSearchMenu({
  position,
  onSelect,
  onClose,
}: {
  position: { x: number; y: number };
  onSelect: (kind: NodeKind) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const all = Object.values(NODE_REGISTRY);
    if (!q) return all.slice(0, 8);
    return all.filter(
      (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ left: position.x, top: position.y }}
        className="fixed z-50 w-72 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
          <Icons.Search size={14} className="text-neutral-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full bg-transparent text-[13px] text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {results.length === 0 && (
            <p className="px-3 py-4 text-center text-[12px] text-neutral-400">No nodes found</p>
          )}
          {results.map((def) => {
            const IconComp = (Icons as unknown as Record<string, Icons.LucideIcon>)[def.icon] || Icons.Box;
            return (
              <button
                key={def.kind}
                onClick={() => onSelect(def.kind)}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  <IconComp size={13} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200">
                    {def.label}
                  </p>
                  <p className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                    {def.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
