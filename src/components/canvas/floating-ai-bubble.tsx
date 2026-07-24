"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, PanelRight, Maximize2, X } from "lucide-react";

export default function FloatingAIBubble({
  onOpenSidebarMode,
}: {
  onOpenSidebarMode: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-5 left-5 z-50">
      {open && (
        <div className="absolute bottom-14 left-0 w-60 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2.5 dark:border-neutral-800">
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-neutral-900 dark:text-neutral-100">
              <Sparkles size={13} />
              AI Agentic
            </span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <X size={13} />
            </button>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onOpenSidebarMode();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <PanelRight size={15} className="shrink-0 text-neutral-400" />
            <span>
              Sidebar AI Mode
              <span className="block text-[10.5px] font-normal text-neutral-400">Tetap di kanvas</span>
            </span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/agent");
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[12.5px] font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            <Maximize2 size={15} className="shrink-0 text-neutral-400" />
            <span>
              Fullscreen Mode
              <span className="block text-[10.5px] font-normal text-neutral-400">Layar penuh</span>
            </span>
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        title="AI Agentic"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition-transform hover:scale-105 dark:bg-white dark:text-neutral-950"
      >
        <Sparkles size={20} />
      </button>
    </div>
  );
}
