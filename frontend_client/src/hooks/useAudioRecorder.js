import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture via MediaRecorder (web standard).
 * Produces chunks suitable for upload/streaming.
 */

// PUBLIC_INTERFACE
export function useAudioRecorder() {
  /** Hook for starting/stopping microphone recording and retrieving audio chunks. */
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const [isSupported, setIsSupported] = useState(true);
  const [permissionState, setPermissionState] = useState("unknown"); // unknown|granted|denied
  const [isRecording, setIsRecording] = useState(false);
  const [chunks, setChunks] = useState([]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setIsSupported(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return { ok: false, error: "Audio recording not supported." };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      permissionState !== "granted" && setPermissionState("granted");
      // Keep stream for actual start() call; immediately stop tracks here to not hold mic open.
      stream.getTracks().forEach((t) => t.stop());
      return { ok: true };
    } catch (e) {
      setPermissionState("denied");
      return { ok: false, error: e?.message || "Microphone permission denied." };
    }
  }, [isSupported, permissionState]);

  const start = useCallback(async () => {
    if (!isSupported) throw new Error("Audio recording not supported in this browser.");
    if (isRecording) return;

    setChunks([]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        setChunks((prev) => [...prev, ev.data]);
      }
    };

    mediaRecorder.onstart = () => setIsRecording(true);
    mediaRecorder.onstop = () => setIsRecording(false);

    mediaRecorder.start(250); // chunk every 250ms for near-realtime streaming
    setPermissionState("granted");
  }, [isSupported, isRecording]);

  const stop = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;

    if (mr.state !== "inactive") {
      mr.stop();
    }
    mediaRecorderRef.current = null;

    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => setChunks([]), []);

  return {
    isSupported,
    permissionState,
    isRecording,
    chunks,
    requestPermission,
    start,
    stop,
    reset,
  };
}
