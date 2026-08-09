import id from "./locales/id";
import en from "./locales/en";
import type { Language } from "@/lib/language-cookie";

export type { Language } from "@/lib/language-cookie";

export const DEFAULT_LANGUAGE: Language = "id";

const dictionaries = { id, en } satisfies Record<Language, unknown>;

// `id` is the source of truth for which keys exist — every translation key
// used anywhere in the app must resolve against it.
type Dictionary = typeof id;

/** Recursively turns a nested dictionary shape into dot-path keys, e.g.
 *  { nav: { run: string } } -> "nav.run". This is what makes `t("nav.run")`
 *  autocomplete and type-check against the actual locale files. */
type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? DotPaths<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = DotPaths<Dictionary>;

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof value === "string" ? value : undefined;
}

/** Looks up a translation key for the given language, falling back to the
 * Indonesian (default) string if the key is missing in that locale —
 * better to show the wrong-language string once than an empty label or a
 * raw key like "nav.run" leaking into the UI. */
export function translate(language: Language, key: TranslationKey): string {
  const dict = dictionaries[language] as unknown as Record<string, unknown>;
  const value = getByPath(dict, key);
  if (value !== undefined) return value;

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] Missing key "${key}" for language "${language}" — falling back to id.`);
  }
  const fallback = getByPath(dictionaries.id as unknown as Record<string, unknown>, key);
  return fallback ?? key;
}

/** Dev-only sanity check: flags any key present in one locale but missing
 * in the other, so translation drift (README §17.4 checklist) gets caught
 * immediately instead of silently falling back at runtime. Called once
 * from the i18n provider on mount. */
export function checkTranslationCoverage() {
  if (process.env.NODE_ENV === "production") return;
  const flatten = (obj: Record<string, unknown>, prefix = ""): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      typeof v === "string" ? [`${prefix}${k}`] : flatten(v as Record<string, unknown>, `${prefix}${k}.`)
    );
  const idKeys = new Set(flatten(id));
  const enKeys = new Set(flatten(en));
  const missingInEn = [...idKeys].filter((k) => !enKeys.has(k));
  const missingInId = [...enKeys].filter((k) => !idKeys.has(k));
  if (missingInEn.length) {
    console.warn("[i18n] Keys missing in en.ts:", missingInEn);
  }
  if (missingInId.length) {
    console.warn("[i18n] Keys missing in id.ts:", missingInId);
  }
}
