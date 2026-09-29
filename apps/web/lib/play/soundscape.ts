/**
 * The table soundscape: procedural ambience, stingers and an optional Bulgarian narrator voice.
 * Everything is synthesised with Web Audio (no audio assets), loaded lazily through
 * soundscape-bridge only while sound is enabled, and never used for live tables, where any
 * sound could reveal who is acting at night. It plays public phase information only.
 */
import { getGameFamily, type GameFamily, type GameMode, type GamePhase, type NarratorVoice } from "@werewolf/shared";
import { getSoundEnabled, SOUND_CHANGE_EVENT } from "@/lib/sound";
import { phaseNarratorLine } from "@/lib/play/phase-display";

export interface SoundScene {
  mode: GameMode;
  phase: GamePhase;
  narratorVoice: NarratorVoice;
}

type Mood = "village-night" | "village-day" | "city-night" | "city-day" | "vote" | "reveal" | "resolution";
type NoiseColor = "white" | "pink" | "brown";

interface Bed {
  mood: Mood;
  output: GainNode;
  echo: AudioNode;
  sources: AudioScheduledSourceNode[];
  schedulers: Array<{ id: number }>;
}

const MASTER_LEVEL = 0.55;
let context: AudioContext | null = null;
let master: GainNode | null = null;
let active: Bed | null = null;
let lastScene: SoundScene | null = null;
let listenersBound = false;
const noiseCache = new Map<NoiseColor, AudioBuffer>();

export function enterPhase(scene: SoundScene) {
  const previous = lastScene;
  lastScene = scene;
  if (!getSoundEnabled()) {
    fadeOut(1.2);
    return;
  }

  const audio = ensureContext();
  if (!audio) return;
  void audio.resume().catch(() => undefined);

  const family = getGameFamily(scene.mode);
  const mood = moodFor(family, scene.phase);
  if (active?.mood !== mood) {
    stopBed(active, 2.2);
    active = mood ? startBed(audio, mood) : null;
  }

  // Joining mid-phase or re-enabling sound restores the bed quietly; only real transitions speak.
  if (previous && previous.phase !== scene.phase) {
    phaseStinger(audio, family, scene.phase, previous.phase);
    window.setTimeout(() => {
      if (lastScene === scene && getSoundEnabled()) speak(phaseNarratorLine(scene.phase, scene.mode, scene.narratorVoice));
    }, 950);
  }
}

export function stinger(kind: "death") {
  if (!context || !master || !getSoundEnabled() || kind !== "death") return;
  deathBlow(context, master);
}

export function stopAll() {
  lastScene = null;
  fadeOut(0.8);
}

function fadeOut(seconds: number) {
  stopBed(active, seconds);
  active = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

function moodFor(family: GameFamily, phase: GamePhase): Mood | null {
  const city = family === "mafia";
  switch (phase) {
    case "first_night":
    case "night":
      return city ? "city-night" : "village-night";
    case "day_announcement":
    case "day_discussion":
    case "nomination":
    case "defense":
      return city ? "city-day" : "village-day";
    case "voting":
      return "vote";
    case "role_reveal":
      return "reveal";
    case "resolution":
    case "hunter_revenge":
    case "mayor_successor":
      return "resolution";
    default:
      return null;
  }
}

function ensureContext() {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context = new Ctor();
  master = context.createGain();
  master.gain.value = MASTER_LEVEL;
  master.connect(context.destination);
  bindListeners();
  return context;
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  // Mobile browsers keep audio suspended until a gesture; resume on the next one.
  const resume = () => { if (active) void context?.resume().catch(() => undefined); };
  window.addEventListener("pointerdown", resume, { passive: true });
  window.addEventListener("keydown", resume);
  document.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (document.hidden) void context.suspend().catch(() => undefined);
    else if (active) void context.resume().catch(() => undefined);
  });
  window.addEventListener(SOUND_CHANGE_EVENT, () => {
    if (!getSoundEnabled()) fadeOut(1);
    else if (lastScene) enterPhase(lastScene);
  });
}

/* ---------- building blocks ---------- */

function noise(audio: AudioContext, color: NoiseColor) {
  const cached = noiseCache.get(color);
  if (cached) return cached;
  const length = audio.sampleRate * 4;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    if (color === "white") {
      data[index] = white;
    } else if (color === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.5;
    } else {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[index] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
  }
  noiseCache.set(color, buffer);
  return buffer;
}

function startBed(audio: AudioContext, mood: Mood): Bed {
  const output = audio.createGain();
  output.gain.value = 0;
  output.connect(master!);

  // A short feedback delay gives distance to calls and bells without a reverb impulse.
  const delay = audio.createDelay(1);
  delay.delayTime.value = 0.27;
  const feedback = audio.createGain();
  feedback.gain.value = 0.34;
  const tone = audio.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 1800;
  delay.connect(tone);
  tone.connect(feedback);
  feedback.connect(delay);
  tone.connect(output);

  const bed: Bed = { mood, output, echo: delay, sources: [], schedulers: [] };
  BUILDERS[mood](audio, bed);
  const now = audio.currentTime;
  output.gain.setValueAtTime(0, now);
  output.gain.linearRampToValueAtTime(1, now + 2.5);
  return bed;
}

function stopBed(bed: Bed | null, seconds: number) {
  if (!bed || !context) return;
  const now = context.currentTime;
  bed.output.gain.cancelScheduledValues(now);
  bed.output.gain.setValueAtTime(bed.output.gain.value, now);
  bed.output.gain.linearRampToValueAtTime(0, now + seconds);
  for (const scheduler of bed.schedulers) window.clearTimeout(scheduler.id);
  window.setTimeout(() => {
    for (const source of bed.sources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    bed.output.disconnect();
  }, seconds * 1000 + 120);
}

function noiseLayer(audio: AudioContext, bed: Bed, color: NoiseColor, filters: Array<[BiquadFilterType, number, number?]>, level: number) {
  const source = audio.createBufferSource();
  source.buffer = noise(audio, color);
  source.loop = true;
  let node: AudioNode = source;
  for (const [type, frequency, q] of filters) {
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    if (q) filter.Q.value = q;
    node.connect(filter);
    node = filter;
  }
  const gain = audio.createGain();
  gain.gain.value = level;
  node.connect(gain);
  gain.connect(bed.output);
  source.start();
  bed.sources.push(source);
  return gain;
}

function drift(audio: AudioContext, bed: Bed, target: AudioParam, rate: number, depth: number) {
  const oscillator = audio.createOscillator();
  oscillator.frequency.value = rate;
  const gain = audio.createGain();
  gain.gain.value = depth;
  oscillator.connect(gain);
  gain.connect(target);
  oscillator.start();
  bed.sources.push(oscillator);
}

function every(bed: Bed, minMs: number, maxMs: number, play: () => void) {
  const scheduler = { id: 0 };
  const next = () => minMs + Math.random() * (maxMs - minMs);
  const tick = () => {
    play();
    scheduler.id = window.setTimeout(tick, next());
  };
  scheduler.id = window.setTimeout(tick, next());
  bed.schedulers.push(scheduler);
}

interface ToneOptions {
  type?: OscillatorType;
  frequency: number;
  glide?: Array<[number, number]>;
  at?: number;
  duration: number;
  gain: number;
  attack?: number;
  vibrato?: [number, number];
}

function voice(audio: AudioContext, destination: AudioNode, options: ToneOptions) {
  const start = audio.currentTime + (options.at ?? 0);
  const end = start + options.duration;
  const oscillator = audio.createOscillator();
  oscillator.type = options.type ?? "sine";
  oscillator.frequency.setValueAtTime(options.frequency, start);
  for (const [frequency, offset] of options.glide ?? []) {
    oscillator.frequency.linearRampToValueAtTime(frequency, start + offset);
  }
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain, start + (options.attack ?? 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  if (options.vibrato) {
    const lfo = audio.createOscillator();
    lfo.frequency.value = options.vibrato[0];
    const depth = audio.createGain();
    depth.gain.value = options.vibrato[1];
    lfo.connect(depth);
    depth.connect(oscillator.frequency);
    lfo.start(start);
    lfo.stop(end);
  }
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(end + 0.05);
}

function noiseBurst(audio: AudioContext, destination: AudioNode, color: NoiseColor, filter: [BiquadFilterType, number], attack: number, decay: number, level: number, at = 0) {
  const start = audio.currentTime + at;
  const source = audio.createBufferSource();
  source.buffer = noise(audio, color);
  const shape = audio.createBiquadFilter();
  shape.type = filter[0];
  shape.frequency.value = filter[1];
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  source.connect(shape);
  shape.connect(gain);
  gain.connect(destination);
  source.start(start, Math.random() * 2);
  source.stop(start + attack + decay + 0.05);
}

function bell(audio: AudioContext, destination: AudioNode, frequency: number, strikes: number, spacing: number, level: number) {
  for (let strike = 0; strike < strikes; strike += 1) {
    const start = audio.currentTime + strike * spacing;
    const carrier = audio.createOscillator();
    carrier.frequency.value = frequency;
    const modulator = audio.createOscillator();
    modulator.frequency.value = frequency * 1.41;
    const index = audio.createGain();
    index.gain.setValueAtTime(frequency * 2.2, start);
    index.gain.exponentialRampToValueAtTime(1, start + 2.4);
    modulator.connect(index);
    index.connect(carrier.frequency);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 3.2);
    carrier.connect(gain);
    gain.connect(destination);
    carrier.start(start);
    modulator.start(start);
    carrier.stop(start + 3.3);
    modulator.stop(start + 3.3);
  }
}

function howl(audio: AudioContext, destination: AudioNode, level: number) {
  const base = 290 + Math.random() * 40;
  voice(audio, destination, {
    frequency: base,
    glide: [[base * 1.85, 1.1], [base * 1.5, 2.7]],
    duration: 3,
    gain: level,
    attack: 0.6,
    vibrato: [5.2, 9],
  });
  voice(audio, destination, {
    frequency: base * 2,
    glide: [[base * 3.7, 1.1], [base * 3, 2.7]],
    duration: 2.8,
    gain: level * 0.18,
    attack: 0.7,
    vibrato: [5.2, 16],
  });
}

function deathBlow(audio: AudioContext, destination: AudioNode) {
  // A rising breath, then a low blow that settles into the floor.
  const start = audio.currentTime;
  const source = audio.createBufferSource();
  source.buffer = noise(audio, "white");
  const sweep = audio.createBiquadFilter();
  sweep.type = "bandpass";
  sweep.Q.value = 1.4;
  sweep.frequency.setValueAtTime(380, start);
  sweep.frequency.exponentialRampToValueAtTime(2600, start + 0.5);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.14, start + 0.48);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.56);
  source.connect(sweep);
  sweep.connect(gain);
  gain.connect(destination);
  source.start(start);
  source.stop(start + 0.6);
  voice(audio, destination, { frequency: 96, glide: [[34, 1.3]], at: 0.5, duration: 1.5, gain: 0.5, attack: 0.006 });
  noiseBurst(audio, destination, "brown", ["lowpass", 380], 0.01, 0.7, 0.3, 0.5);
}

function phaseStinger(audio: AudioContext, family: GameFamily, phase: GamePhase, previousPhase: GamePhase) {
  if (!master) return;
  const city = family === "mafia";
  const dawn = phase === "day_announcement"
    || (phase === "day_discussion" && (previousPhase === "night" || previousPhase === "first_night"));
  if (phase === "night" || phase === "first_night") {
    if (city) bell(audio, master, 392, 2, 1.25, 0.08);
    else howl(audio, active?.echo ?? master, 0.09);
  } else if (dawn) {
    bell(audio, master, city ? 523 : 311, city ? 1 : 3, 1.1, 0.07);
  } else if (phase === "resolution") {
    bell(audio, master, 147, 1, 1, 0.12);
  }
}

/* ---------- moods ---------- */

const BUILDERS: Record<Mood, (audio: AudioContext, bed: Bed) => void> = {
  "village-night"(audio, bed) {
    const wind = noiseLayer(audio, bed, "brown", [["lowpass", 420]], 0.16);
    drift(audio, bed, wind.gain, 0.06, 0.07);
    every(bed, 140, 520, () => {
      const pitch = 4300 + Math.random() * 500;
      for (let chirp = 0; chirp < 3; chirp += 1) {
        voice(audio, bed.output, { frequency: pitch, at: chirp * 0.045, duration: 0.03, gain: 0.011, attack: 0.004 });
      }
    });
    every(bed, 17000, 34000, () => {
      voice(audio, bed.echo, { frequency: 392, glide: [[362, 0.4]], duration: 0.45, gain: 0.03, attack: 0.08 });
      voice(audio, bed.echo, { frequency: 372, glide: [[340, 0.55]], at: 0.62, duration: 0.6, gain: 0.026, attack: 0.08 });
    });
    every(bed, 38000, 70000, () => howl(audio, bed.echo, 0.035));
  },
  "village-day"(audio, bed) {
    const breeze = noiseLayer(audio, bed, "pink", [["bandpass", 900, 0.6]], 0.045);
    drift(audio, bed, breeze.gain, 0.09, 0.02);
    every(bed, 900, 4200, () => {
      const base = 2600 + Math.random() * 1400;
      const chirps = 2 + Math.floor(Math.random() * 3);
      for (let chirp = 0; chirp < chirps; chirp += 1) {
        voice(audio, bed.output, {
          frequency: base,
          glide: [[base * (1.2 + Math.random() * 0.3), 0.06], [base * 0.9, 0.12]],
          at: chirp * 0.16,
          duration: 0.13,
          gain: 0.014,
          attack: 0.01,
        });
      }
    });
  },
  "city-night"(audio, bed) {
    noiseLayer(audio, bed, "white", [["highpass", 1100], ["lowpass", 6400]], 0.075);
    noiseLayer(audio, bed, "pink", [["lowpass", 700]], 0.05);
    every(bed, 90, 320, () => {
      voice(audio, bed.output, { type: "triangle", frequency: 1800 + Math.random() * 1400, duration: 0.02, gain: 0.008, attack: 0.002 });
    });
    every(bed, 26000, 56000, () => noiseBurst(audio, bed.output, "brown", ["lowpass", 130], 0.7, 3.6, 0.32));
  },
  "city-day"(audio, bed) {
    const murmur = noiseLayer(audio, bed, "pink", [["lowpass", 460]], 0.06);
    drift(audio, bed, murmur.gain, 0.05, 0.02);
    noiseLayer(audio, bed, "pink", [["bandpass", 820, 0.7]], 0.018);
    every(bed, 40, 220, () => {
      voice(audio, bed.output, { type: "square", frequency: 2600 + Math.random() * 1800, duration: 0.005, gain: 0.005, attack: 0.001 });
    });
  },
  vote(audio, bed) {
    const drone = audio.createOscillator();
    drone.type = "sawtooth";
    drone.frequency.value = 55;
    const shade = audio.createBiquadFilter();
    shade.type = "lowpass";
    shade.frequency.value = 180;
    const level = audio.createGain();
    level.gain.value = 0.03;
    drone.connect(shade);
    shade.connect(level);
    level.connect(bed.output);
    drone.start();
    bed.sources.push(drone);
    drift(audio, bed, shade.frequency, 0.18, 60);
    every(bed, 860, 940, () => {
      voice(audio, bed.output, { frequency: 58, glide: [[42, 0.14]], duration: 0.15, gain: 0.26, attack: 0.005 });
      voice(audio, bed.output, { frequency: 54, glide: [[40, 0.12]], at: 0.19, duration: 0.13, gain: 0.18, attack: 0.005 });
    });
  },
  reveal(audio, bed) {
    const notes = [1318.5, 1568, 1760, 2093];
    every(bed, 600, 1500, () => {
      voice(audio, bed.echo, { frequency: notes[Math.floor(Math.random() * notes.length)]!, duration: 1.6, gain: 0.012, attack: 0.3 });
    });
  },
  resolution(audio, bed) {
    for (const [frequency, gain] of [[73.4, 0.035], [110, 0.022]] as const) {
      const drone = audio.createOscillator();
      drone.frequency.value = frequency;
      const level = audio.createGain();
      level.gain.value = gain;
      drone.connect(level);
      level.connect(bed.output);
      drone.start();
      bed.sources.push(drone);
    }
  },
};

/* ---------- narrator ---------- */

let pendingLine: string | null = null;

/** Reads the public phase line, only with a Bulgarian voice; foreign voices would mangle it. */
function speak(line: string) {
  const synth = typeof window === "undefined" ? undefined : window.speechSynthesis;
  if (!synth || !line) return;
  const voices = synth.getVoices();
  if (voices.length === 0) {
    // Voices load asynchronously on first use; retry once when they arrive.
    if (pendingLine === null) {
      synth.addEventListener("voiceschanged", () => {
        const queued = pendingLine;
        pendingLine = null;
        if (queued) speak(queued);
      }, { once: true });
    }
    pendingLine = line;
    return;
  }
  const bulgarian = voices.find((candidate) => candidate.lang.toLowerCase().startsWith("bg"));
  if (!bulgarian) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(line);
  utterance.voice = bulgarian;
  utterance.lang = bulgarian.lang;
  utterance.rate = 0.92;
  utterance.pitch = 0.82;
  utterance.volume = 0.9;
  synth.speak(utterance);
}
