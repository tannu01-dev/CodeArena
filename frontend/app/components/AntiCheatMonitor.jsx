"use client";
import { useEffect, useRef } from "react";
import { codeArenaApi } from "../lib/codearena";

export default function AntiCheatMonitor({ attemptId, enabled, onWarning, onTerminated }) {
  const seen = useRef(new Map());
  useEffect(() => {
    if (!attemptId || !enabled) return;
    let disposed = false;
    const report = async (type, details = "") => {
      const now = Date.now();
      const previous = seen.current.get(type) || 0;
      if (now - previous < 1200) return;
      seen.current.set(type, now);
      const eventId = `${attemptId}-${type}-${now}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const result = await codeArenaApi.reportViolation(attemptId, { eventId, type, details });
        if (disposed) return;
        if (result.terminated) onTerminated?.(result.warning || "Assessment terminated due to integrity violations.");
        else if (!result.duplicate) onWarning?.(result.warning || `Integrity warning ${result.count}/3`, result.count);
      } catch (error) {
        if (!disposed && /no longer active|not active/i.test(error.message || "")) onTerminated?.("This assessment is no longer active.");
      }
    };
    const onCopy = (event) => { event.preventDefault(); report("copy", "Copy action in assessment workspace"); };
    const onCut = (event) => { event.preventDefault(); report("cut", "Cut action in assessment workspace"); };
    const onPaste = (event) => { event.preventDefault(); report("paste", "Paste action in assessment workspace"); };
    const onVisibility = () => { if (document.visibilityState === "hidden") report("tab_hidden", "Assessment tab became hidden"); };
    const onBlur = () => report("window_blur", "Assessment window lost focus");
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCut, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      disposed = true;
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [attemptId, enabled, onWarning, onTerminated]);
  return null;
}
