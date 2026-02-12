import React from "react";
import "../App.css";

/**
 * Central avatar placeholder with subtle neon animation.
 * (Actual 3D face integration can replace this component later.)
 */

// PUBLIC_INTERFACE
export function AvatarStage({ status, reducedMotion }) {
  /** Displays the central avatar/face placeholder and current system status. */
  return (
    <section className="avatarStage" aria-label="Avatar stage">
      <div
        className={`avatarFrame ${reducedMotion ? "reducedMotion" : ""}`}
        role="img"
        aria-label="Humanoid face placeholder"
      >
        <div className="avatarScanlines" aria-hidden="true" />
        <div className="avatarCore" aria-hidden="true">
          <div className="avatarHalo" />
          <div className="avatarFace">
            <div className="avatarEye left" />
            <div className="avatarEye right" />
            <div className="avatarMouth" />
          </div>
        </div>

        <div className="avatarStatus" aria-live="polite">
          {status}
        </div>
      </div>

      <p className="avatarHint">
        3D face/avatar will render here. This placeholder is optimized for low-latency UI testing.
      </p>
    </section>
  );
}
