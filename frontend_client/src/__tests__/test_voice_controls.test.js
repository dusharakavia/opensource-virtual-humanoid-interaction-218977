import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VoiceControls } from "../components/VoiceControls";

// Mock audio recorder hook to avoid dealing with MediaRecorder in jsdom.
jest.mock("../hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => ({
    isSupported: true,
    permissionState: "granted",
    isRecording: false,
    chunks: [],
    requestPermission: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    reset: jest.fn(),
  }),
}));

test("VoiceControls sends text on submit and clears the input", async () => {
  const onSendText = jest.fn();

  const user = userEvent.setup();
  render(
    <VoiceControls
      onSendText={onSendText}
      onSendAudio={jest.fn()}
      isStreaming={false}
      wsStatus="connected"
      backendHealthStatus="ok"
      reducedMotion={false}
    />
  );

  const input = screen.getByLabelText(/message/i);
  await user.type(input, "Hello world");
  await user.click(screen.getByRole("button", { name: /send/i }));

  expect(onSendText).toHaveBeenCalledWith("Hello world");
  expect(input).toHaveValue("");
});

test("VoiceControls disables Send when input is empty/whitespace", async () => {
  const user = userEvent.setup();
  render(
    <VoiceControls
      onSendText={jest.fn()}
      onSendAudio={jest.fn()}
      isStreaming={false}
      wsStatus="disconnected"
      backendHealthStatus="ok"
      reducedMotion={false}
    />
  );

  const input = screen.getByLabelText(/message/i);
  const sendBtn = screen.getByRole("button", { name: /send/i });

  expect(sendBtn).toBeDisabled();
  await user.type(input, "   ");
  expect(sendBtn).toBeDisabled();
});
