import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { AvatarStage } from "./components/AvatarStage";
import { ConversationHistory } from "./components/ConversationHistory";
import { VoiceControls } from "./components/VoiceControls";
import { AccessibilityPanel } from "./components/AccessibilityPanel";
import { AboutCredits } from "./components/AboutCredits";
import { useConversationSession } from "./hooks/useConversationSession";

// PUBLIC_INTERFACE
function App() {
  /** Main application layout and orchestration of session state. */
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [theme, setTheme] = useState("dark");
  const [reducedMotion, setReducedMotion] = useState(!!prefersReducedMotion);
  const [largeText, setLargeText] = useState(false);

  const { state, api } = useConversationSession();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-reduced-motion", reducedMotion ? "true" : "false");
  }, [reducedMotion]);

  useEffect(() => {
    document.documentElement.setAttribute("data-large-text", largeText ? "true" : "false");
  }, [largeText]);

  const statusLine = useMemo(() => {
    const h = state.backendHealth.status;
    const w = state.ws.status;

    if (h === "loading") return "Booting: checking backend…";
    if (h === "error") return `Backend error: ${state.backendHealth.error || "unreachable"}`;
    if (w === "connecting") return "Connecting to streaming channel…";
    if (w === "error") return state.ws.error || "Streaming unavailable";
    if (w === "connected") return state.isStreaming ? "Listening & responding…" : "Ready";
    return "Offline (connect when backend WS is available)";
  }, [state]);

  const robotExpressiveAttribution = useMemo(
    () =>
      [
        "“RobotExpressive” model from KhronosGroup glTF Sample Models.",
        "Source: https://github.com/KhronosGroup/glTF-Sample-Models/tree/master/2.0/RobotExpressive",
        "License: See `2.0/RobotExpressive/README.md` in the source repository.",
        "Changes: None.",
      ].join("\n"),
    []
  );

  return (
    <div className="App">
      <div className="appShell">
        <header className="topBar">
          <div className="brandBlock">
            <div className="brandMark" aria-hidden="true" />
            <div>
              <h1 className="brandTitle">Neon Violet Humanoid</h1>
              <p className="brandSubtitle">Realtime voice + conversation interface</p>
            </div>
          </div>

          <div className="topBarRight">
            <button type="button" className="btn ghost" onClick={() => api.refreshHealth()}>
              Refresh
            </button>
            <button
              type="button"
              className="btn neon"
              onClick={() => (state.ws.status === "connected" ? api.disconnectWs() : api.connectWs())}
              aria-pressed={state.ws.status === "connected"}
            >
              {state.ws.status === "connected" ? "Disconnect" : "Connect"}
            </button>
          </div>
        </header>

        <main className="mainGrid" aria-label="Main content">
          <div className="centerColumn">
            <AvatarStage status={statusLine} reducedMotion={reducedMotion} />

            <VoiceControls
              onSendText={api.sendUserText}
              onSendAudio={api.sendUserAudio}
              isStreaming={state.isStreaming}
              wsStatus={state.ws.status}
              backendHealthStatus={state.backendHealth.status}
              reducedMotion={reducedMotion}
            />

            {(state.backendHealth.status === "error" || state.ws.status === "error") && (
              <div className="errorBanner" role="alert">
                <strong>Connection issue.</strong>{" "}
                <span>
                  {state.backendHealth.status === "error"
                    ? state.backendHealth.error
                    : state.ws.error}
                </span>
                <div className="errorActions">
                  <button type="button" className="btn ghost" onClick={() => api.refreshHealth()}>
                    Retry health
                  </button>
                  <button type="button" className="btn ghost" onClick={() => api.connectWs()}>
                    Retry WS
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="sideColumn">
            <ConversationHistory messages={state.messages} />
            <AccessibilityPanel
              theme={theme}
              onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              reducedMotion={reducedMotion}
              onToggleReducedMotion={() => setReducedMotion((v) => !v)}
              largeText={largeText}
              onToggleLargeText={() => setLargeText((v) => !v)}
            />

            <AboutCredits attributionText={robotExpressiveAttribution} />

            <section className="sysPanel" aria-label="System status">
              <div className="panelHeader">
                <h2 className="panelTitle">System</h2>
              </div>

              <div className="sysGrid">
                <div className="sysItem">
                  <span className="sysKey">Backend</span>
                  <span className={`sysVal val-${state.backendHealth.status}`}>
                    {state.backendHealth.status}
                  </span>
                </div>
                <div className="sysItem">
                  <span className="sysKey">WebSocket</span>
                  <span className={`sysVal val-${state.ws.status}`}>{state.ws.status}</span>
                </div>
              </div>

              <p className="tinyStatus">
                Configure backend URL via <code>REACT_APP_BACKEND_URL</code>. REST endpoints:{" "}
                <code>/v1/sessions</code>, <code>/v1/chat</code>, <code>/v1/stt</code>,{" "}
                <code>/v1/tts</code>. WebSocket: <code>/v1/ws?session_id=…</code>.
              </p>
            </section>
          </aside>
        </main>

        <footer className="footer">
          <span>© Neon Violet Interface</span>
          <span className="footerSep">•</span>
          <a className="footerLink" href="https://react.dev" target="_blank" rel="noreferrer">
            React
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
