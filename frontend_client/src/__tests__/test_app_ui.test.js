import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../App";

// Mock the hook that orchestrates API + state so App tests are stable and fast.
jest.mock("../hooks/useConversationSession", () => ({
  useConversationSession: jest.fn(),
}));

const { useConversationSession } = require("../hooks/useConversationSession");

function makeState(overrides = {}) {
  return {
    backendHealth: { status: "ok", error: null },
    ws: { status: "disconnected", error: null },
    isStreaming: false,
    isPlayingAudio: false,
    messages: [],
    ...overrides,
  };
}

function makeApi(overrides = {}) {
  return {
    refreshHealth: jest.fn(),
    refreshCapabilities: jest.fn(),
    ensureSession: jest.fn(),
    connectWs: jest.fn(),
    disconnectWs: jest.fn(),
    sendUserText: jest.fn(),
    sendUserAudio: jest.fn(),
    ...overrides,
  };
}

test("App renders stable header and toggles Connect/Disconnect action based on ws.status", async () => {
  const api = makeApi();

  useConversationSession.mockReturnValue({
    state: makeState({ ws: { status: "disconnected", error: null } }),
    api,
  });

  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole("heading", { name: /neon violet humanoid/i })).toBeInTheDocument();

  const connectBtn = screen.getByRole("button", { name: /connect/i });
  await user.click(connectBtn);
  expect(api.connectWs).toHaveBeenCalledTimes(1);
  expect(api.disconnectWs).not.toHaveBeenCalled();

  // Re-render with connected state and verify it calls disconnect
  useConversationSession.mockReturnValue({
    state: makeState({ ws: { status: "connected", error: null } }),
    api,
  });
  render(<App />);

  const disconnectBtn = screen.getByRole("button", { name: /disconnect/i });
  await user.click(disconnectBtn);
  expect(api.disconnectWs).toHaveBeenCalledTimes(1);
});

test("App shows error banner when backend health is error and provides retry actions", async () => {
  const api = makeApi();

  useConversationSession.mockReturnValue({
    state: makeState({
      backendHealth: { status: "error", error: "backend down" },
      ws: { status: "disconnected", error: null },
    }),
    api,
  });

  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole("alert")).toHaveTextContent(/connection issue/i);
  expect(screen.getByRole("alert")).toHaveTextContent("backend down");

  await user.click(screen.getByRole("button", { name: /retry health/i }));
  expect(api.refreshHealth).toHaveBeenCalledTimes(1);

  await user.click(screen.getByRole("button", { name: /retry ws/i }));
  expect(api.connectWs).toHaveBeenCalledTimes(1);
});
