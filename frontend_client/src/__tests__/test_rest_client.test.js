import { chat, createSession, getBackendInfo, getHealth } from "../api/restClient";

function mockFetchOnce(impl) {
  global.fetch = jest.fn(impl);
}

beforeEach(() => {
  jest.restoreAllMocks();
  delete process.env.REACT_APP_BACKEND_URL;
});

test("getBackendInfo derives httpBase and wsBase", () => {
  process.env.REACT_APP_BACKEND_URL = "http://localhost:3001/";
  const info = getBackendInfo();
  expect(info.httpBase).toBe("http://localhost:3001");
  expect(info.wsBase).toBe("ws://localhost:3001");
});

test("getHealth calls GET / and returns JSON", async () => {
  process.env.REACT_APP_BACKEND_URL = "http://api.example";
  mockFetchOnce(async (url, init) => {
    expect(url).toBe("http://api.example/");
    expect(init.method).toBe("GET");
    return {
      ok: true,
      json: async () => ({ message: "Healthy" }),
    };
  });

  await expect(getHealth()).resolves.toEqual({ message: "Healthy" });
});

test("createSession posts to /v1/sessions with expected JSON body shape", async () => {
  process.env.REACT_APP_BACKEND_URL = "http://api.example";
  mockFetchOnce(async (url, init) => {
    expect(url).toBe("http://api.example/v1/sessions");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body).toEqual({ user_id: "u1", metadata: { x: 1 } });

    return { ok: true, json: async () => ({ session_id: "sess_123", created_at_ms: 1 }) };
  });

  const res = await createSession({ userId: "u1", metadata: { x: 1 } });
  expect(res.session_id).toBe("sess_123");
});

test("chat posts to /v1/chat with expected payload and throws on non-2xx", async () => {
  process.env.REACT_APP_BACKEND_URL = "http://api.example";
  mockFetchOnce(async (url, init) => {
    expect(url).toBe("http://api.example/v1/chat");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ session_id: "sess_1", text: "hi", stream: false });

    return { ok: false, status: 500, json: async () => ({ detail: "boom" }) };
  });

  await expect(chat({ sessionId: "sess_1", text: "hi" })).rejects.toThrow(/Chat failed \(500\)/);
});
