/**
 * WebSocket client wrapper for backend streaming conversation/audio.
 *
 * Backend OpenAPI currently only exposes GET / (health). This wrapper is implemented
 * to be ready once the backend adds a WebSocket endpoint.
 */

function getBackendWsUrl() {
  const backend = process.env.REACT_APP_BACKEND_URL;
  if (backend) {
    // Convert http(s) -> ws(s)
    return backend.replace(/^http/, "ws").replace(/\/$/, "");
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:3001`;
}

/**
 * @typedef {Object} WsClientHandlers
 * @property {(ev: MessageEvent) => void} [onMessage]
 * @property {(ev: Event) => void} [onOpen]
 * @property {(ev: CloseEvent) => void} [onClose]
 * @property {(err: Event) => void} [onError]
 */

/**
 * Simple WS client with optional auto-reconnect.
 */
export class WsClient {
  /**
   * @param {Object} params
   * @param {string} params.path websocket path (e.g., "/ws")
   * @param {WsClientHandlers} params.handlers
   * @param {boolean} [params.autoReconnect]
   */
  constructor({ path, handlers, autoReconnect = true }) {
    this.path = path || "/ws";
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
    const base = getBackendWsUrl().replace(/\/$/, "");
    const url = `${base}${this.path.startsWith("/") ? this.path : `/${this.path}`}`;

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
