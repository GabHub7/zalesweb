"use client";

import { useState, useRef, useEffect } from "react";
import * as Icons from "lucide-react";
import { useZalesStore } from "@/store/zales-store";
import type { Language } from "@/lib/language-cookie";

const OPTIONS: { code: Language; flag: string; labelKey: "language.id" | "language.en" }[] = [
  { code: "id", flag: "🇮🇩", labelKey: "language.id" },
  { code: "en", flag: "🇬🇧", labelKey: "language.en" },
];

/** Small flag-based language switcher (README §12 — must be easy to find,
 * switches the whole UI immediately, no reload required). Used in the
 * toolbar; the choice is persisted via a cookie in setLanguage(). */
export default function LanguageSelector() {
  const language = useZalesStore((s) => s.language);
  const setLanguage = useZalesStore((s) => s.setLanguage);
  const t = useZalesStore((s) => s.t);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const current = OPTIONS.find((o) => o.code === language) ?? OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={t("language.selectorLabel")}
        className="flex items-center gap-1 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      >
        <span className="text-[14px] leading-none">{current.flag}</span>
        <Icons.ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => {
                setLanguage(opt.code);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                opt.code === language
                  ? "font-medium text-neutral-900 dark:text-neutral-100"
                  : "text-neutral-600 dark:text-neutral-400"
              }`}
            >
              <span className="text-[14px] leading-none">{opt.flag}</span>
              {t(opt.labelKey)}
              {opt.code === language && <Icons.Check size={12} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
