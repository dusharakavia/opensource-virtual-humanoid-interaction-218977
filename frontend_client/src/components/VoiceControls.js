import React, { useEffect, useMemo, useState } from "react";
import "../App.css";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

/**
 * Voice controls: push-to-talk plus text input fallback.
 */

// PUBLIC_INTERFACE
export function VoiceControls({
  onSendText,
  onSendAudio,
  isStreaming,
  wsStatus,
  backendHealthStatus,
  reducedMotion,
}) {
  /** Provides mic capture controls and a text input fallback. */
  const recorder = useAudioRecorder();
  const [text, setText] = useState("");

  const canUseMic = useMemo(
    () => recorder.isSupported && recorder.permissionState !== "denied",
    [recorder.isSupported, recorder.permissionState]
  );

  const primaryStatus = useMemo(() => {
    if (backendHealthStatus === "loading") return "Checking backend…";
    if (backendHealthStatus === "error") return "Backend offline";
    if (wsStatus === "connecting") return "Connecting stream…";
    if (wsStatus === "connected" && isStreaming) return "Streaming…";
    if (wsStatus === "connected") return "Connected";
    return "Disconnected";
  }, [backendHealthStatus, wsStatus, isStreaming]);

  // When user stops recording, auto-send the captured audio to backend STT -> chat -> TTS.
  useEffect(() => {
    if (recorder.isRecording) return;
    if (!onSendAudio) return;
    if (recorder.chunks.length === 0) return;

    const blob = new Blob(recorder.chunks, { type: "audio/webm" });
    // Fire-and-forget; hook manages messages/errors.
    onSendAudio({ audioBlob: blob, mimeType: "audio/webm" });
    recorder.reset();
  }, [recorder.isRecording, recorder.chunks, onSendAudio, recorder]);

  const onSubmit = (e) => {
    e.preventDefault();
    onSendText?.(text);
    setText("");
  };

  return (
    <section className="controlsPanel" aria-label="Voice and input controls">
      <div className="panelHeader">
        <h2 className="panelTitle">Controls</h2>
        <span className={`statusPill status-${primaryStatus.replace(/\s+/g, "").toLowerCase()}`}>
          {primaryStatus}
        </span>
      </div>

      <div className="controlsGrid">
        <div className="controlCard">
          <h3 className="controlTitle">Voice</h3>
          <p className="controlDesc">
            Push-to-talk sends audio to the backend (STT → chat → TTS playback).
          </p>

          <div className="controlRow">
            <button
              type="button"
              className={`btn neon ${recorder.isRecording ? "danger" : ""}`}
              onClick={async () => {
                if (!canUseMic) {
                  await recorder.requestPermission();
                  return;
                }
                if (recorder.isRecording) await recorder.stop();
                else await recorder.start();
              }}
              disabled={!recorder.isSupported}
              aria-pressed={recorder.isRecording}
            >
              {recorder.isRecording ? "Stop Mic" : "Push to Talk"}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={() => recorder.reset()}
              disabled={recorder.chunks.length === 0}
            >
              Clear Audio
            </button>
          </div>

          <div className="tinyStatus" aria-live="polite">
            {!recorder.isSupported && "Your browser does not support audio capture."}
            {recorder.isSupported &&
              recorder.permissionState === "denied" &&
              "Microphone permission denied."}
            {recorder.isSupported &&
              recorder.permissionState !== "denied" &&
              `${recorder.chunks.length} audio chunks captured`}
          </div>
        </div>

        <div className="controlCard">
          <h3 className="controlTitle">Text</h3>
          <p className="controlDesc">Type a message and send (REST fallback works without WS).</p>

          <form className="textForm" onSubmit={onSubmit}>
            <label className="srOnly" htmlFor="messageInput">
              Message
            </label>
            <input
              id="messageInput"
              className={`textInput ${reducedMotion ? "reducedMotion" : ""}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something…"
              autoComplete="off"
            />
            <button type="submit" className="btn neon" disabled={!text.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
