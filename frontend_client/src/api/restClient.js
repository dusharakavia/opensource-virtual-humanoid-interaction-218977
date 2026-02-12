/**
 * REST client wrapper for the backend_api container.
 * Uses environment variables so deployment can swap URLs without code changes.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Attempt to read a JSON error body; fall back to text.
 * @param {Response} res
 * @returns {Promise<string>}
 */
async function readErrorBody(res) {
  try {
    const data = await res.json();
    return typeof data === "string" ? data : JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return "Unknown error";
    }
  }
}

/**
 * @returns {string}
 */
function getBackendBaseUrl() {
  // CRA only exposes env vars prefixed with REACT_APP_
  return (
    process.env.REACT_APP_BACKEND_URL ||
    `${window.location.protocol}//${window.location.hostname}:3001`
  );
}

/**
 * @param {string} path
 * @returns {string}
 */
function withBase(path) {
  const base = getBackendBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * @param {RequestInit} init
 * @returns {RequestInit}
 */
function withJsonHeaders(init = {}) {
  return {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  };
}

// PUBLIC_INTERFACE
export async function getHealth({ signal } = {}) {
  /** Health check against GET / */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(withBase("/"), {
      method: "GET",
      ...withJsonHeaders(),
      signal: signal || controller.signal,
    });
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw new Error(`Health check failed (${res.status}): ${body}`);
    }
    // backend currently returns {} schema; tolerate empty body
    try {
      return await res.json();
    } catch {
      return {};
    }
  } finally {
    clearTimeout(timeout);
  }
}
