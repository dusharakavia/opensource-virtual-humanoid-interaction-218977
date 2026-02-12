import React from "react";
import "../App.css";

/**
 * Accessibility + UX options:
 * - theme switch
 * - reduced motion
 * - large text
 */

// PUBLIC_INTERFACE
export function AccessibilityPanel({
  theme,
  onToggleTheme,
  reducedMotion,
  onToggleReducedMotion,
  largeText,
  onToggleLargeText,
}) {
  /** Provides accessibility-related toggles for theme, motion, and typography. */
  return (
    <section className="a11yPanel" aria-label="Accessibility options">
      <div className="panelHeader">
        <h2 className="panelTitle">Accessibility</h2>
      </div>

      <div className="a11yGrid">
        <button
          type="button"
          className="btn ghost"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          Theme: {theme === "dark" ? "Neon Night" : "Neon Day"}
        </button>

        <button
          type="button"
          className="btn ghost"
          onClick={onToggleReducedMotion}
          aria-pressed={reducedMotion}
        >
          Reduced motion: {reducedMotion ? "On" : "Off"}
        </button>

        <button
          type="button"
          className="btn ghost"
          onClick={onToggleLargeText}
          aria-pressed={largeText}
        >
          Large text: {largeText ? "On" : "Off"}
        </button>
      </div>

      <p className="tinyStatus">
        Tip: Your OS “Reduce motion” preference is respected by default; you can override it here.
      </p>
    </section>
  );
}
