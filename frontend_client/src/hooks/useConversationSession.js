import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { getHealth } from "../api/restClient";
import { WsClient } from "../api/wsClient";

/**
 * Conversation state model:
 * - messages: array of {id, role: 'user'|'assistant'|'system', text, ts}
 * - connection/streaming: ws status + backend health
 */

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const initialState = {
  backendHealth: { status: "idle", error: null }, // idle|loading|ok|error
  ws: { status: "disconnected", error: null }, // disconnected|connecting|connected|error
  isStreaming: false,
  messages: [
    {
      id: uid(),
      role: "system",
      text: "Neon Violet interface online. Connect to backend to start a session.",
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
      // If no assistant exists, create one.
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

// PUBLIC_INTERFACE
export function useConversationSession() {
  /** Hook that manages backend connectivity, WS streaming events, and message history. */
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);

  const refreshHealth = useCallback(async () => {
    dispatch({ type: "health/loading" });
    try {
      await getHealth();
      dispatch({ type: "health/ok" });
    } catch (e) {
      dispatch({ type: "health/error", error: e?.message || "Health check failed." });
    }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current) return;

    dispatch({ type: "ws/connecting" });

    const ws = new WsClient({
      path: "/ws", // backend will need to implement; wrapper is ready
      autoReconnect: true,
      handlers: {
        onOpen: () => dispatch({ type: "ws/connected" }),
        onClose: () => dispatch({ type: "ws/disconnected" }),
        onError: () =>
          dispatch({
            type: "ws/error",
            error:
              "WebSocket error (backend may not expose WS endpoint yet).",
          }),
        onMessage: (ev) => {
          // Expect JSON messages eventually: {type: 'assistant_delta'|'assistant_message'|'status', ...}
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "assistant_delta" && typeof msg.delta === "string") {
              dispatch({ type: "msg/append_to_last_assistant", delta: msg.delta });
              return;
            }
            if (msg.type === "assistant_message" && typeof msg.text === "string") {
              dispatch({
                type: "msg/add",
                message: { id: uid(), role: "assistant", text: msg.text, ts: Date.now() },
              });
              return;
            }
            if (msg.type === "stream_start") dispatch({ type: "stream/start" });
            if (msg.type === "stream_stop") dispatch({ type: "stream/stop" });
          } catch {
            // tolerate non-JSON
          }
        },
      },
    });

    wsRef.current = ws;
    ws.connect();
  }, []);

  const disconnectWs = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.close();
    wsRef.current = null;
    dispatch({ type: "ws/disconnected" });
  }, []);

  const sendUserText = useCallback((text) => {
    const clean = (text || "").trim();
    if (!clean) return;

    dispatch({
      type: "msg/add",
      message: { id: uid(), role: "user", text: clean, ts: Date.now() },
    });

    // If WS connected, send over WS. Otherwise, just show local message.
    try {
      if (wsRef.current?.isConnected()) {
        wsRef.current.sendJson({ type: "user_text", text: clean });
      } else {
        dispatch({
          type: "msg/add",
          message: {
            id: uid(),
            role: "system",
            text:
              "Not connected to streaming backend. Message stored locally (connect WS when available).",
            ts: Date.now(),
          },
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
    }
  }, []);

  useEffect(() => {
    // Initial health check
    refreshHealth();
  }, [refreshHealth]);

  const api = useMemo(
    () => ({
      refreshHealth,
      connectWs,
      disconnectWs,
      sendUserText,
    }),
    [refreshHealth, connectWs, disconnectWs, sendUserText]
  );

  return { state, api };
}
