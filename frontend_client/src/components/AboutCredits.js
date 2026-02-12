import React from "react";
import "../App.css";

/**
 * In-app About / Credits section (includes required third-party attribution text).
 */

// PUBLIC_INTERFACE
export function AboutCredits({ attributionText }) {
  /** Renders an About/Credits panel with third-party attribution. */
  return (
    <section className="creditsPanel" aria-label="About and credits">
      <div className="panelHeader">
        <h2 className="panelTitle">About / Credits</h2>
      </div>

      <p className="tinyStatus">
        This demo uses a public 3D model hosted on the open web. Attribution is provided below.
      </p>

      <div className="creditsBox" role="note" aria-label="Third-party attribution">
        <pre className="creditsPre">{attributionText}</pre>
      </div>
    </section>
  );
}
