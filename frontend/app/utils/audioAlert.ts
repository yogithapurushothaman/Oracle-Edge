/**
 * ORACLE Edge - Synthesized Browser Audio Warning Chime
 * Native Web Audio API utility (zero external asset dependencies)
 * Authoritative tactical two-tone alert chime:
 * Tone 1: 880Hz (A5) for 120ms
 * Pause: 80ms
 * Tone 2: 1175Hz (D6) for 200ms
 */

let sharedAudioCtx: AudioContext | null = null;
let isMutedState: boolean = false;
let isInitialized: boolean = false;

/**
 * Safely initializes and resumes the Web Audio API context on user gesture.
 */
export const initAudioContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;

  try {
    if (!sharedAudioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }

    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {
        // Silently catch in case browser policy requires further direct gesture
      });
    }
  } catch (err) {
    console.warn("[ORACLE Audio] Web Audio API init error:", err);
  }

  return sharedAudioCtx;
};

/**
 * Prime audio context automatically upon the first user interaction anywhere on the window.
 */
if (typeof window !== "undefined" && !isInitialized) {
  isInitialized = true;
  const unlockAudio = () => {
    initAudioContext();
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };

  window.addEventListener("click", unlockAudio, { passive: true, once: true });
  window.addEventListener("keydown", unlockAudio, { passive: true, once: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true, once: true });
}

/**
 * Retrieve current mute state, syncing with localStorage.
 */
export const getAudioMuted = (): boolean => {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("oracle_audio_muted");
      if (saved !== null) {
        isMutedState = saved === "true";
        return isMutedState;
      }
    } catch {
      // localStorage might be unavailable in private browsing
    }
  }
  return isMutedState;
};

/**
 * Set audio mute state and broadcast event.
 */
export const setAudioMuted = (muted: boolean): void => {
  isMutedState = muted;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("oracle_audio_muted", String(muted));
      window.dispatchEvent(
        new CustomEvent("oracle-audio-mute-change", { detail: { muted } })
      );
    } catch {
      // Ignore storage errors
    }
  }
};

/**
 * Toggle audio mute state.
 */
export const toggleAudioMute = (): boolean => {
  const next = !getAudioMuted();
  setAudioMuted(next);
  return next;
};

/**
 * Plays an authoritative tactical two-tone chime:
 * 880Hz beep for 120ms, 80ms pause, followed by a 1175Hz pulse for 200ms.
 * Completely non-blocking and safe against unhandled autoplay restrictions.
 */
export const playCriticalAlert = async (): Promise<void> => {
  if (getAudioMuted()) {
    return;
  }

  try {
    const ctx = initAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== "running") {
      return;
    }

    const now = ctx.currentTime;

    // Master safety gain node to prevent harsh clipping
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.35, now);
    masterGain.connect(ctx.destination);

    // ==========================================
    // Tone 1: 880 Hz beep for 120ms (0.12s)
    // ==========================================
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);

    // Smooth envelope: 5ms attack, 10ms decay to prevent clicking
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(1.0, now + 0.008);
    gain1.gain.setValueAtTime(1.0, now + 0.11);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.12);

    // ==========================================
    // Pause: 80ms (0.08s) -> Tone 2 starts at now + 0.20s
    // Tone 2: 1175 Hz pulse for 200ms (0.20s) -> ends at now + 0.40s
    // ==========================================
    const tone2Start = now + 0.12 + 0.08;
    const tone2End = tone2Start + 0.20;

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1175, tone2Start);

    gain2.gain.setValueAtTime(0.0001, tone2Start);
    gain2.gain.exponentialRampToValueAtTime(1.0, tone2Start + 0.012);
    gain2.gain.setValueAtTime(0.85, tone2Start + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.0001, tone2End);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(tone2Start);
    osc2.stop(tone2End);
  } catch (err) {
    // Non-blocking: never throw or disrupt SSE telemetry loop
    console.warn("[ORACLE Audio] Audio chime playback bypassed:", err);
  }
};
