/**
 * Where the API lives.
 *
 * In development this is empty, so requests go to `/api` on the Vite dev
 * server, which proxies them to the API. Cookies are then same-origin and
 * behave exactly as they will in production.
 *
 * In production the two are usually on different hosts — a static host for the
 * app, somewhere with a Node runtime for the API — so `VITE_API_URL` supplies
 * the API's origin at build time. Without it a deployed build would request
 * `/api` from the static host and get a 404.
 */
const configured = import.meta.env.VITE_API_URL?.trim() ?? "";

/** No trailing slash, so joining a path never produces a double slash. */
export const API_ORIGIN = configured.replace(/\/+$/, "");

/** Absolute URL for an API path such as "/tasks". */
export function apiUrl(path: string): string {
  return `${API_ORIGIN}/api${path.startsWith("/") ? path : `/${path}`}`;
}
