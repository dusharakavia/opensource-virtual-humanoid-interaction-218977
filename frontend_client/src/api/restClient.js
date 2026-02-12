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

/**
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
function arrayBufferToBase64(buf) {
  // Browser-safe conversion; avoids Node Buffer.
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
}

/**
 * @param {any} value
 * @returns {string}
 */
function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// PUBLIC_INTERFACE
export function getBackendInfo() {
  /** Get resolved backend base URL (http/https) and ws base URL (ws/wss). */
  const httpBase = getBackendBaseUrl().replace(/\/$/, "");
  const wsBase = httpBase.replace(/^http/, "ws");
  return { httpBase, wsBase };
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
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// PUBLIC_INTERFACE
export async function getCapabilities({ signal } = {}) {
  /** Get backend capabilities (active providers and supported realtime event types). */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(withBase("/v1/capabilities"), {
      method: "GET",
      ...withJsonHeaders(),
      signal: signal || controller.signal,
    });
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw new Error(`Capabilities failed (${res.status}): ${body}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// PUBLIC_INTERFACE
export async function createSession({ userId = null, metadata = {} } = {}, { signal } = {}) {
  /** Create a new backend session. Returns {session_id, created_at_ms}. */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(withBase("/v1/sessions"), {
      method: "POST",
      ...withJsonHeaders({
        body: safeStringify({ user_id: userId, metadata }),
      }),
      signal: signal || controller.signal,
    });
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw new Error(`Create session failed (${res.status}): ${body}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// PUBLIC_INTERFACE
export async function chat({ sessionId, text, stream = false }, { signal } = {}) {
  /** Send user text to backend REST chat endpoint. Returns final assistant response. */
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(withBase("/v1/chat"), {
      method: "POST",
      ...withJsonHeaders({
        body: safeStringify({ session_id: sessionId, text, stream }),
      }),
      signal: signal || controller.signal,
    });
    if (!res.ok) {
      const body = await readErrorBody(res);
      throw new Error(`Chat failed (${res.status}): ${body}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// PUBLIC_INTERFACE
export async function stt({ sessionId, audioBlob, mimeType = "audio/webm", language = null }) {
  /** Speech-to-text: uploads audio as base64 in JSON. Returns {text, provider, ...}. */
  if (!audioBlob) throw new Error("audioBlob is required for STT");

  const ab = await audioBlob.arrayBuffer();
  const audio_base64 = arrayBufferToBase64(ab);

  const res = await fetch(withBase("/v1/stt"), {
    method: "POST",
    ...withJsonHeaders({
      body: safeStringify({
        session_id: sessionId,
        audio_base64,
        mime_type: mimeType || "audio/webm",
        language,
      }),
    }),
  });

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`STT failed (${res.status}): ${body}`);
  }
  return await res.json();
}

// PUBLIC_INTERFACE
export async function tts({ sessionId, text, voice = null, mimeType = "audio/wav" }) {
  /** Text-to-speech: returns base64 audio (or not_available). */
  const res = await fetch(withBase("/v1/tts"), {
    method: "POST",
    ...withJsonHeaders({
      body: safeStringify({
        session_id: sessionId,
        text,
        voice,
        mime_type: mimeType || "audio/wav",
      }),
    }),
  });

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new Error(`TTS failed (${res.status}): ${body}`);
  }
  return await res.json();
}
