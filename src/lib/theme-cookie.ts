export const THEME_COOKIE = "zales-theme";

/** Persists the theme choice so the server can render the right class on
 * <html> for the very first paint — this is what kills the light/dark
 * flicker on navigation and reload (spec §3). */
export function persistThemeCookie(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}
