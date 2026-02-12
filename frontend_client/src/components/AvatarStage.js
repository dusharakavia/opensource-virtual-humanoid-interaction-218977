import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import "../App.css";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * 3D Avatar stage using react-three-fiber.
 * Loads the selected public GLB model (RobotExpressive) from a URL.
 */

const ROBOT_EXPRESSIVE_GLB_URL = "/assets/RobotExpressive.glb";

/**
 * Try to pick a sensible idle animation clip by name, otherwise fall back to the first clip.
 * @param {THREE.AnimationClip[]} clips
 * @returns {THREE.AnimationClip | null}
 */
function selectIdleClip(clips) {
  if (!clips || clips.length === 0) return null;

  const byName = (re) => clips.find((c) => re.test((c?.name || "").toLowerCase()));
  return (
    byName(/idle|breath|stand|pose|neutral/) ||
    // Some sample models include "Walking", "Running", etc; idle isn't guaranteed.
    clips[0] ||
    null
  );
}

/**
 * A small helper component that:
 * - loads the GLB
 * - starts an idle animation (if present)
 * - applies gentle morph-target "expression" blending if present
 */
function RobotExpressiveModel({ reducedMotion, onLoaded }) {
  const group = useRef(null);
  const gltf = useGLTF(ROBOT_EXPRESSIVE_GLB_URL);
  const { actions, clips, mixer } = useAnimations(gltf.animations || [], group);

  const [hasMorphTargets, setHasMorphTargets] = useState(false);
  const morphTargets = useRef([]); // [{ mesh, nameToIndex, influences }]
  const idleActionRef = useRef(null);

  // Identify morph target meshes once the model is loaded.
  useEffect(() => {
    if (!gltf?.scene) return;

    const found = [];
    gltf.scene.traverse((obj) => {
      // meshes only
      if (!obj.isMesh) return;
      const dict = obj.morphTargetDictionary;
      const influences = obj.morphTargetInfluences;
      if (!dict || !influences || influences.length === 0) return;

      found.push({
        mesh: obj,
        nameToIndex: dict,
        influences,
      });
    });

    morphTargets.current = found;
    setHasMorphTargets(found.length > 0);
  }, [gltf]);

  // Setup animation and notify parent.
  useEffect(() => {
    onLoaded?.({
      url: ROBOT_EXPRESSIVE_GLB_URL,
      animationCount: (clips || []).length,
      morphTargetMeshCount: morphTargets.current.length,
    });

    // Start idle animation if possible.
    const idleClip = selectIdleClip(clips || []);
    if (!idleClip || !actions) return;

    const act = actions[idleClip.name];
    if (!act) return;

    idleActionRef.current = act;
    act.reset();
    act.setLoop(THREE.LoopRepeat, Infinity);
    act.fadeIn(0.35);
    act.play();

    return () => {
      try {
        act.fadeOut(0.2);
        act.stop();
      } catch {
        // ignore
      }
    };
  }, [actions, clips, onLoaded]);

  // Reduced motion: pause mixer updates (keeps model visible but still).
  useFrame((_, delta) => {
    if (reducedMotion) return;
    mixer?.update(delta);
  });

  // Gentle "expression breathing" if there are morph targets.
  // If the model has standard expression targets (e.g., smile/frown/blink), this will lightly animate them.
  useFrame((state) => {
    if (reducedMotion) return;
    if (!hasMorphTargets) return;

    const t = state.clock.getElapsedTime();

    // Subtle oscillations. We try to hit common names, but if not present we animate the first few indices gently.
    const preferredTargets = [
      { re: /blink|eye.*close/, amp: 0.18, speed: 1.15, bias: 0.0 },
      { re: /smile|happy/, amp: 0.12, speed: 0.35, bias: 0.06 },
      { re: /mouth.*open|jawopen/, amp: 0.06, speed: 0.55, bias: 0.0 },
    ];

    morphTargets.current.forEach(({ nameToIndex, influences }) => {
      let anyPreferred = false;

      preferredTargets.forEach((pt) => {
        const key = Object.keys(nameToIndex).find((k) => pt.re.test(k.toLowerCase()));
        if (!key) return;
        anyPreferred = true;
        const idx = nameToIndex[key];

        // Clamp influences to [0,1]
        const v = pt.bias + pt.amp * (0.5 + 0.5 * Math.sin(t * pt.speed));
        influences[idx] = Math.max(0, Math.min(1, v));
      });

      if (!anyPreferred) {
        // Fallback: animate first 1-2 morphs very subtly to avoid uncanny deformation.
        if (influences.length >= 1) influences[0] = 0.03 + 0.02 * (0.5 + 0.5 * Math.sin(t * 0.4));
        if (influences.length >= 2) influences[1] = 0.02 + 0.015 * (0.5 + 0.5 * Math.sin(t * 0.33));
      }
    });
  });

  // A bit of model setup: position/scale tuned for the stage.
  // RobotExpressive is full-body; we frame upper torso/head by moving it down slightly.
  return (
    <group ref={group} dispose={null} position={[0, -1.2, 0]} scale={1.2}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function LoadingOverlay({ status }) {
  return (
    <div className="avatarOverlay" role="status" aria-live="polite">
      <div className="avatarOverlayCard">
        <div className="avatarOverlayTitle">Loading avatar…</div>
        <div className="avatarOverlayText">{status}</div>
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
export function AvatarStage({ status, reducedMotion }) {
  /** Displays the 3D avatar stage and current system status line. */
  const [loadMeta, setLoadMeta] = useState(null);

  const stageHint = useMemo(() => {
    if (!loadMeta) return "Fetching public GLB model (RobotExpressive)…";
    const anim = loadMeta.animationCount || 0;
    const morphMeshes = loadMeta.morphTargetMeshCount || 0;
    return `RobotExpressive loaded • Animations: ${anim} • Expression meshes: ${morphMeshes}`;
  }, [loadMeta]);

  return (
    <section className="avatarStage" aria-label="Avatar stage">
      <div className={`avatarFrame ${reducedMotion ? "reducedMotion" : ""}`}>
        <div className="avatarScanlines" aria-hidden="true" />

        <Canvas
          className="avatarCanvas"
          camera={{ position: [0, 0.25, 2.35], fov: 35, near: 0.1, far: 100 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
        >
          {/* Basic studio-ish lighting */}
          <ambientLight intensity={0.65} />
          <directionalLight position={[3, 5, 3]} intensity={1.05} />
          <directionalLight position={[-3, 2.5, 1]} intensity={0.55} color={"#a5b4fc"} />
          <pointLight position={[0, 1.8, 2]} intensity={0.25} color={"#22d3ee"} />

          {/* Nice IBL env; does not require external images */}
          <Environment preset="city" />

          <Suspense fallback={null}>
            <RobotExpressiveModel reducedMotion={reducedMotion} onLoaded={setLoadMeta} />
          </Suspense>

          {/* User controls: orbit around the avatar. */}
          <OrbitControls
            enablePan={false}
            enableDamping={!reducedMotion}
            dampingFactor={0.08}
            minDistance={1.6}
            maxDistance={3.6}
            minPolarAngle={0.15}
            maxPolarAngle={Math.PI / 2}
            target={[0, 0.45, 0]}
          />
        </Canvas>

        {!loadMeta && <LoadingOverlay status="Loading local GLB asset…" />}

        <div className="avatarStatus" aria-live="polite">
          {status}
        </div>
      </div>

      <p className="avatarHint">
        {stageHint} {" "}
        <span className="avatarHintSep">•</span>{" "}
        Drag to rotate. Scroll to zoom.
      </p>
    </section>
  );
}

useGLTF.preload(ROBOT_EXPRESSIVE_GLB_URL);
