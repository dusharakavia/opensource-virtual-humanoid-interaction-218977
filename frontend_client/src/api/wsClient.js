/**
 * WebSocket client wrapper for backend streaming conversation/audio.
 *
 * Backend expects:
 * - Connect to `/v1/ws?session_id=<id>`
 * - Server emits JSON events like: `assistant.token`, `assistant.message`, `stt.final`, etc.
 */

import { getBackendInfo } from "./restClient";

/**
 * @typedef {Object} WsClientHandlers
 * @property {(ev: MessageEvent) => void} [onMessage]
 * @property {(ev: Event) => void} [onOpen]
 * @property {(ev: CloseEvent) => void} [onClose]
 * @property {(err: Event) => void} [onError]
 */

/**
 * Build a WebSocket URL using the backend base URL and optional query params.
 * @param {string} path
 * @param {Record<string, string | number | boolean | null | undefined>} [query]
 * @returns {string}
 */
function buildWsUrl(path, query = {}) {
  const { wsBase } = getBackendInfo();
  const base = wsBase.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;

  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    qs.set(k, String(v));
  });

  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return `${base}${p}${suffix}`;
}

/**
 * Simple WS client with optional auto-reconnect.
 */
export class WsClient {
  /**
   * @param {Object} params
   * @param {string} params.path websocket path (e.g., "/v1/ws")
   * @param {Record<string, any>} [params.query] query parameters
   * @param {WsClientHandlers} params.handlers
   * @param {boolean} [params.autoReconnect]
   */
  constructor({ path, query = {}, handlers, autoReconnect = true }) {
    this.path = path || "/v1/ws";
    this.query = query;
    this.handlers = handlers || {};
    this.autoReconnect = autoReconnect;

    this._ws = null;
    this._closedByUser = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
  }

  /**
   * @returns {boolean}
   */
  isConnected() {
    return this._ws && this._ws.readyState === WebSocket.OPEN;
  }

  /**
   * Connect the socket.
   */
  connect() {
    this._closedByUser = false;
    const url = buildWsUrl(this.path, this.query);

    this._ws = new WebSocket(url);

    this._ws.onopen = (ev) => {
      this._reconnectAttempt = 0;
      this.handlers.onOpen?.(ev);
    };

    this._ws.onmessage = (ev) => {
      this.handlers.onMessage?.(ev);
    };

    this._ws.onerror = (ev) => {
      this.handlers.onError?.(ev);
    };

    this._ws.onclose = (ev) => {
      this.handlers.onClose?.(ev);
      if (!this._closedByUser && this.autoReconnect) {
        this._scheduleReconnect();
      }
    };
  }

  /**
   * Close the socket and stop reconnect.
   */
  close() {
    this._closedByUser = true;
    if (this._reconnectTimer) window.clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;

    if (this._ws) {
      try {
        this._ws.close(1000, "client_close");
      } catch {
        // ignore
      }
    }
    this._ws = null;
  }

  /**
   * Send JSON payload.
   * @param {any} payload
   */
  sendJson(payload) {
    if (!this.isConnected()) throw new Error("WebSocket is not connected");
    this._ws.send(JSON.stringify(payload));
  }

  _scheduleReconnect() {
    const baseDelay = 500;
    const maxDelay = 8000;
    const delay = Math.min(maxDelay, baseDelay * 2 ** this._reconnectAttempt);
    const jitter = Math.floor(Math.random() * 250);
    const finalDelay = delay + jitter;

    this._reconnectAttempt += 1;
    this._reconnectTimer = window.setTimeout(() => this.connect(), finalDelay);
  }
}
