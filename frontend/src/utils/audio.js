let audioCtx = null;

export function getAudioContext() {
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function beep(freq = 600, duration = 0.08, type = "sine", volume = 0.05, enabled = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  } catch (e) {
    console.warn("Beep failed:", e);
  }
}

export function buzz(pattern = 10, enabled = true) {
  if (enabled && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }
}

export function say(text, slow = false, lang = "en-US") {
  if (!("speechSynthesis" in window)) {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = slow ? 0.72 : 0.95;
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) {
    console.warn("TTS failed:", e);
    return false;
  }
}

let wakeLockInstance = null;

export async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLockInstance = await navigator.wakeLock.request("screen");
    }
  } catch {}
}

export function releaseWakeLock() {
  try {
    if (wakeLockInstance) {
      wakeLockInstance.release();
    }
  } catch {}
  wakeLockInstance = null;
}
