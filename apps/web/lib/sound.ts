export type CueName = "vote" | "kill" | "phase-change" | "win";

export const SOUND_STORAGE_KEY = "werewolf-sound";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

interface PlayCueOptions {
  forceSilent?: boolean;
  storage?: StorageLike;
}

const CUE_PATTERNS: Record<CueName, Array<{ frequency: number; type: OscillatorType; at: number; length: number; gain: number }>> = {
  vote: [
    { frequency: 392, type: "triangle", at: 0, length: 0.09, gain: 0.045 },
    { frequency: 587, type: "sine", at: 0.07, length: 0.11, gain: 0.035 },
    { frequency: 784, type: "square", at: 0.14, length: 0.07, gain: 0.018 },
  ],
  kill: [
    { frequency: 164, type: "sawtooth", at: 0, length: 0.18, gain: 0.035 },
    { frequency: 123, type: "triangle", at: 0.05, length: 0.2, gain: 0.04 },
    { frequency: 82, type: "sine", at: 0.12, length: 0.25, gain: 0.03 },
  ],
  "phase-change": [
    { frequency: 247, type: "sine", at: 0, length: 0.12, gain: 0.035 },
    { frequency: 330, type: "triangle", at: 0.08, length: 0.16, gain: 0.028 },
    { frequency: 494, type: "sine", at: 0.18, length: 0.18, gain: 0.022 },
  ],
  win: [
    { frequency: 262, type: "triangle", at: 0, length: 0.16, gain: 0.035 },
    { frequency: 392, type: "sine", at: 0.11, length: 0.2, gain: 0.034 },
    { frequency: 659, type: "triangle", at: 0.26, length: 0.32, gain: 0.026 },
  ],
};

export function getSoundEnabled(storage: StorageLike | undefined = getBrowserStorage()) {
  return storage?.getItem(SOUND_STORAGE_KEY) === "on";
}

export function setSoundEnabled(enabled: boolean, storage: StorageLike | undefined = getBrowserStorage()) {
  storage?.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
}

export function shouldPlayCue({ forceSilent = false, storage }: PlayCueOptions = {}) {
  return !forceSilent && getSoundEnabled(storage);
}

export function playCue(name: CueName, options: PlayCueOptions = {}) {
  if (typeof window === "undefined" || !shouldPlayCue(options)) {
    return false;
  }

  try {
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return false;
    }

    const context = new AudioContextCtor();
    const master = context.createGain();
    master.gain.setValueAtTime(0.9, context.currentTime);
    master.connect(context.destination);

    for (const voice of CUE_PATTERNS[name]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const startAt = context.currentTime + voice.at;
      const endAt = startAt + voice.length;

      oscillator.type = voice.type;
      oscillator.frequency.setValueAtTime(voice.frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(voice.gain, startAt + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.015);
    }

    const longestCueMs = Math.max(...CUE_PATTERNS[name].map((voice) => (voice.at + voice.length) * 1000));
    window.setTimeout(() => void context.close(), longestCueMs + 120);
    return true;
  } catch {
    // Mobile browsers often block Web Audio until a gesture. Visual feedback still works.
    return false;
  }
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage;
}
