import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { chat, createSession, getCapabilities, getHealth, stt, tts } from "../api/restClient";
import { WsClient } from "../api/wsClient";

/**
 * Conversation state model:
 * - session: server session_id
 * - messages: array of {id, role: 'user'|'assistant'|'system', text, ts}
 * - connection/streaming: ws status + backend health + capabilities
 * - audio: whether we are currently playing assistant audio
 */

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const initialState = {
  backendHealth: { status: "idle", error: null }, // idle|loading|ok|error
  capabilities: { status: "idle", data: null, error: null }, // idle|loading|ok|error
  session: { status: "idle", sessionId: null, error: null }, // idle|creating|ready|error
  ws: { status: "disconnected", error: null }, // disconnected|connecting|connected|error
  isStreaming: false,
  isPlayingAudio: false,
  messages: [
    {
      id: uid(),
      role: "system",
      text: "Neon Violet interface online. Creating a backend session…",
      ts: Date.now(),
    },
  ],
};

function reducer(state, action) {
  switch (action.type) {
    case "health/loading":
      return { ...state, backendHealth: { status: "loading", error: null } };
    case "health/ok":
      return { ...state, backendHealth: { status: "ok", error: null } };
    case "health/error":
      return { ...state, backendHealth: { status: "error", error: action.error } };

    case "cap/loading":
      return { ...state, capabilities: { status: "loading", data: null, error: null } };
    case "cap/ok":
      return { ...state, capabilities: { status: "ok", data: action.data, error: null } };
    case "cap/error":
      return { ...state, capabilities: { status: "error", data: null, error: action.error } };

    case "session/creating":
      return { ...state, session: { status: "creating", sessionId: null, error: null } };
    case "session/ready":
      return { ...state, session: { status: "ready", sessionId: action.sessionId, error: null } };
    case "session/error":
      return { ...state, session: { status: "error", sessionId: null, error: action.error } };

    case "ws/connecting":
      return { ...state, ws: { status: "connecting", error: null } };
    case "ws/connected":
      return { ...state, ws: { status: "connected", error: null } };
    case "ws/disconnected":
      return { ...state, ws: { status: "disconnected", error: null } };
    case "ws/error":
      return { ...state, ws: { status: "error", error: action.error } };

    case "stream/start":
      return { ...state, isStreaming: true };
    case "stream/stop":
      return { ...state, isStreaming: false };

    case "audio/playing":
      return { ...state, isPlayingAudio: true };
    case "audio/stopped":
      return { ...state, isPlayingAudio: false };

    case "msg/add":
      return { ...state, messages: [...state.messages, action.message] };

    case "msg/append_to_last_assistant": {
      const msgs = [...state.messages];
      for (let i = msgs.length - 1; i >= 0; i -= 1) {
        if (msgs[i].role === "assistant") {
          msgs[i] = { ...msgs[i], text: `${msgs[i].text}${action.delta}` };
          return { ...state, messages: msgs };
        }
      }
      return {
        ...state,
        messages: [
          ...msgs,
          { id: uid(), role: "assistant", text: action.delta, ts: Date.now() },
        ],
      };
    }

    default:
      return state;
  }
}

/**
 * @param {string} base64
 * @returns {Blob}
 */
function base64ToBlob(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "audio/wav" });
}

/**
 * Play assistant audio if provided; safe no-op on errors.
 * @param {string | null | undefined} audioBase64
 * @param {() => void} onStart
 * @param {() => void} onStop
 */
async function playAssistantAudio(audioBase64, { onStart, onStop }) {
  if (!audioBase64) return;
  try {
    const blob = base64ToBlob(audioBase64);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    onStart?.();
    audio.onended = () => {
      onStop?.();
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      onStop?.();
      URL.revokeObjectURL(url);
    };

    // Some browsers require a user gesture to start audio; if blocked, this will reject.
    await audio.play();
  } catch {
    onStop?.();
  }
}

// PUBLIC_INTERFACE
export function useConversationSession() {
  /** Hook that manages backend connectivity, WS streaming events, and message history. */
  const [state, dispatch] = useReducer(reducer, initialState);

  const wsRef = useRef(null);
  const sessionIdRef = useRef(null);

  const refreshHealth = useCallback(async () => {
    dispatch({ type: "health/loading" });
    try {
      const res = await getHealth();
      if (res?.status === "ok" || res?.message || res) dispatch({ type: "health/ok" });
      else dispatch({ type: "health/ok" });
    } catch (e) {
      dispatch({ type: "health/error", error: e?.message || "Health check failed." });
    }
  }, []);

  const refreshCapabilities = useCallback(async () => {
    dispatch({ type: "cap/loading" });
    try {
      const data = await getCapabilities();
      dispatch({ type: "cap/ok", data });
    } catch (e) {
      dispatch({ type: "cap/error", error: e?.message || "Capabilities check failed." });
    }
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current) return sessionIdRef.current;

    dispatch({ type: "session/creating" });
    try {
      const res = await createSession({ metadata: { client: "frontend_client" } });
      sessionIdRef.current = res.session_id;
      dispatch({ type: "session/ready", sessionId: res.session_id });
      dispatch({
        type: "msg/add",
        message: {
          id: uid(),
          role: "system",
          text: `Session ready: ${res.session_id}`,
          ts: Date.now(),
        },
      });
      return res.session_id;
    } catch (e) {
      dispatch({ type: "session/error", error: e?.message || "Failed to create session." });
      dispatch({
        type: "msg/add",
        message: {
          id: uid(),
          role: "system",
          text: e?.message || "Failed to create session.",
          ts: Date.now(),
        },
      });
      return null;
    }
  }, []);

  const connectWs = useCallback(async () => {
    if (wsRef.current) return;

    const sessionId = await ensureSession();
    if (!sessionId) return;

    dispatch({ type: "ws/connecting" });

    const ws = new WsClient({
      path: "/v1/ws",
      query: { session_id: sessionId },
      autoReconnect: true,
      handlers: {
        onOpen: () => dispatch({ type: "ws/connected" }),
        onClose: () => dispatch({ type: "ws/disconnected" }),
        onError: () =>
          dispatch({
            type: "ws/error",
            error: "WebSocket error (check backend URL/CORS/WS availability).",
          }),
        onMessage: (ev) => {
          // Backend emits events like "assistant.token", "assistant.message", "status", etc.
          try {
            const msg = JSON.parse(ev.data);

            const type = msg?.type;
            if (type === "assistant.token" && typeof msg.token === "string") {
              dispatch({ type: "msg/append_to_last_assistant", delta: msg.token });
              return;
            }
            if (type === "assistant.message" && typeof msg.text === "string") {
              dispatch({
                type: "msg/add",
                message: { id: uid(), role: "assistant", text: msg.text, ts: Date.now() },
              });
              return;
            }
            if (type === "stt.final" && typeof msg.text === "string") {
              dispatch({
                type: "msg/add",
                message: { id: uid(), role: "system", text: `STT: ${msg.text}`, ts: Date.now() },
              });
              return;
            }
            if (type === "stream.start") dispatch({ type: "stream/start" });
            if (type === "stream.stop") dispatch({ type: "stream/stop" });
          } catch {
            // tolerate non-JSON
          }
        },
      },
    });

    wsRef.current = ws;
    ws.connect();
  }, [ensureSession]);

  const disconnectWs = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.close();
    wsRef.current = null;
    dispatch({ type: "ws/disconnected" });
  }, []);

  const sendUserText = useCallback(
    async (text) => {
      const clean = (text || "").trim();
      if (!clean) return;

      const sessionId = await ensureSession();
      if (!sessionId) return;

      dispatch({
        type: "msg/add",
        message: { id: uid(), role: "user", text: clean, ts: Date.now() },
      });

      // If WS connected, request streaming there; otherwise do REST and add final message.
      try {
        if (wsRef.current?.isConnected()) {
          // Server-side protocol: keep it simple and send a typed message.
          wsRef.current.sendJson({ type: "user.text", text: clean });
          dispatch({
            type: "msg/add",
            message: { id: uid(), role: "assistant", text: "", ts: Date.now() },
          });
          dispatch({ type: "stream/start" });
          return;
        }

        const res = await chat({ sessionId, text: clean, stream: false });
        dispatch({
          type: "msg/add",
          message: {
            id: res.message_id || uid(),
            role: "assistant",
            text: res.response_text || "(empty response)",
            ts: res.created_at_ms || Date.now(),
          },
        });

        // Request TTS and play if available (fallback providers may return not_available).
        const ttsRes = await tts({ sessionId, text: res.response_text || "" });
        if (ttsRes?.status === "ok" && ttsRes.audio_base64) {
          await playAssistantAudio(ttsRes.audio_base64, {
            onStart: () => dispatch({ type: "audio/playing" }),
            onStop: () => dispatch({ type: "audio/stopped" }),
          });
        }
      } catch (e) {
        dispatch({
          type: "msg/add",
          message: {
            id: uid(),
            role: "system",
            text: e?.message || "Failed to send message.",
            ts: Date.now(),
          },
        });
      } finally {
        dispatch({ type: "stream/stop" });
      }
    },
    [ensureSession]
  );

  const sendUserAudio = useCallback(
    async ({ audioBlob, mimeType = "audio/webm" }) => {
      const sessionId = await ensureSession();
      if (!sessionId) return;

      dispatch({
        type: "msg/add",
        message: {
          id: uid(),
          role: "system",
          text: "Processing audio (STT)…",
          ts: Date.now(),
        },
      });

      try {
        const sttRes = await stt({ sessionId, audioBlob, mimeType });
        const transcript = (sttRes?.text || "").trim();

        if (!transcript) {
          dispatch({
            type: "msg/add",
            message: {
              id: uid(),
              role: "system",
              text: "STT returned empty transcript.",
              ts: Date.now(),
            },
          });
          return;
        }

        // Reuse text pipeline (REST or WS streaming depending on connection)
        await sendUserText(transcript);
      } catch (e) {
        dispatch({
          type: "msg/add",
          message: {
            id: uid(),
            role: "system",
            text: e?.message || "Audio processing failed.",
            ts: Date.now(),
          },
        });
      }
    },
    [ensureSession, sendUserText]
  );

  useEffect(() => {
    // Initial health/capabilities checks + session creation (best-effort)
    refreshHealth();
    refreshCapabilities();
    ensureSession();
  }, [refreshHealth, refreshCapabilities, ensureSession]);

  const api = useMemo(
    () => ({
      refreshHealth,
      refreshCapabilities,
      ensureSession,
      connectWs,
      disconnectWs,
      sendUserText,
      sendUserAudio,
    }),
    [
      refreshHealth,
      refreshCapabilities,
      ensureSession,
      connectWs,
      disconnectWs,
      sendUserText,
      sendUserAudio,
    ]
  );

  return { state, api };
}
