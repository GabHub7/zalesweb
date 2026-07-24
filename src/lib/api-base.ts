/** When Zales is split across two deployments — the canvas UI on Vercel,
 *  the actual server (WA socket, scheduler, DB) on a server panel like
 *  Pterodactyl/Back4app — set NEXT_PUBLIC_API_BASE_URL on the Vercel side
 *  to point at the server panel's public URL. Leave it empty when running
 *  as a single all-in-one deployment (the normal case), and every request
 *  just stays same-origin like before. */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
