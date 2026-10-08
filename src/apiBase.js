// Where the Spring Boot backend lives.
// - Local dev: empty → relative URLs, proxied to localhost:8080 by vite.config.mjs.
// - Render static site: VITE_API_BASE_URL=https://<backend>.onrender.com (set at build time).
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Paths served by the backend (same list as the dev proxy in vite.config.mjs)
const BACKEND_PATHS = /^\/(api|tasks|auth|notify|oauth2|login\/oauth2)(\/|\?|$)/;

/** Absolute backend URL for a path like "/oauth2/authorization/google". */
export const apiUrl = (path) => (API_BASE && BACKEND_PATHS.test(path) ? API_BASE + path : path);

// The app calls fetch("/tasks"), fetch("/api/…") etc. everywhere; when the frontend is
// hosted separately, send those calls to the backend instead of the static host.
if (API_BASE && typeof window !== "undefined" && !window.__apiBasePatched) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    originalFetch(typeof input === "string" ? apiUrl(input) : input, init);
  window.__apiBasePatched = true;
}
