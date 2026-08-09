export const LANGUAGE_COOKIE = "zales-language";
export type Language = "id" | "en";

/** Persists the language choice so the server can render the right
 * `<html lang>` on the very first paint, and so a browser refresh never
 * silently falls back to the default language (README §12.1). */
export function persistLanguageCookie(language: Language) {
  if (typeof document === "undefined") return;
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=31536000; SameSite=Lax`;
}
