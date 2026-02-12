import React, { useEffect, useRef } from "react";
import "../App.css";

/**
 * Scrollable conversation panel.
 */

// PUBLIC_INTERFACE
export function ConversationHistory({ messages }) {
  /** Renders the chat transcript with role styling and auto-scroll. */
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <section className="historyPanel" aria-label="Conversation history">
      <div className="panelHeader">
        <h2 className="panelTitle">Transcript</h2>
        <span className="panelBadge">{messages.length}</span>
      </div>

      <div className="historyScroll" role="log" aria-live="polite" aria-relevant="additions text">
        {messages.map((m) => (
          <div key={m.id} className={`msgRow role-${m.role}`}>
            <div className="msgMeta">
              <span className="msgRole">{m.role}</span>
              <span className="msgTime">
                {new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="msgBubble">
              <p className="msgText">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
