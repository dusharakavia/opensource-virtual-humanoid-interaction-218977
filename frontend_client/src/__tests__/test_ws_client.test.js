import { WsClient } from "../api/wsClient";

jest.mock("../api/restClient", () => ({
  getBackendInfo: () => ({ httpBase: "http://localhost:3001", wsBase: "ws://localhost:3001" }),
}));

class FakeWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.({ type: "open" });
  }

  send(payload) {
    this.sent.push(payload);
  }

  close(code, reason) {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

beforeEach(() => {
  global.WebSocket = FakeWebSocket;
});

test("WsClient builds URL with query params and connects", () => {
  const handlers = { onOpen: jest.fn() };
  const wsClient = new WsClient({ path: "/v1/ws", query: { session_id: "sess_1" }, handlers });

  wsClient.connect();

  // Access created ws and simulate open
  expect(wsClient._ws.url).toBe("ws://localhost:3001/v1/ws?session_id=sess_1");
  wsClient._ws.open();

  expect(handlers.onOpen).toHaveBeenCalled();
  expect(wsClient.isConnected()).toBe(true);
});

test("WsClient sendJson throws when not connected; sends JSON when connected", () => {
  const wsClient = new WsClient({ path: "/v1/ws", query: { session_id: "sess_1" }, handlers: {} });
  wsClient.connect();

  expect(() => wsClient.sendJson({ a: 1 })).toThrow(/not connected/i);

  wsClient._ws.open();
  wsClient.sendJson({ a: 1 });

  expect(wsClient._ws.sent).toEqual([JSON.stringify({ a: 1 })]);
});
