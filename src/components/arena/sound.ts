// Tiny synthesized sound effects for the arena (Web Audio, no asset files).
// Browsers only allow audio after a user gesture, which every battle action is.

const MUTE_KEY = "frg.arenaMuted";
let context: AudioContext | null = null;

export function isMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function setMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* storage unavailable: stays for this page only */ }
}

function audio() {
  if (isMuted() || typeof AudioContext === "undefined") return null;
  context ??= new AudioContext();
  if (context.state === "suspended") context.resume().catch(() => undefined);
  return context;
}

function tone(freq: number, duration: number, options: { type?: OscillatorType; to?: number; gain?: number; delay?: number } = {}) {
  const ctx = audio();
  if (!ctx) return;
  const start = ctx.currentTime + (options.delay ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = options.type ?? "square";
  osc.frequency.setValueAtTime(freq, start);
  if (options.to) osc.frequency.exponentialRampToValueAtTime(options.to, start + duration);
  gain.gain.setValueAtTime(options.gain ?? 0.06, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise(duration: number, gainValue = 0.08) {
  const ctx = audio();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = gainValue;
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

export const sfx = {
  swing: () => tone(300, 0.12, { type: "sine", to: 600, gain: 0.05 }),
  hit: () => { noise(0.12); tone(140, 0.1, { gain: 0.05 }); },
  crit: () => { noise(0.2, 0.12); tone(880, 0.25, { to: 220, gain: 0.07 }); },
  miss: () => tone(900, 0.18, { type: "sine", to: 300, gain: 0.05 }),
  special: () => tone(200, 0.35, { type: "sawtooth", to: 1200, gain: 0.05 }),
  heal: () => [523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: "sine", gain: 0.05, delay: i * 0.08 })),
  status: () => tone(330, 0.2, { type: "triangle", to: 220, gain: 0.06 }),
  guard: () => [440, 440].forEach((f, i) => tone(f, 0.08, { type: "triangle", gain: 0.06, delay: i * 0.1 })),
  faint: () => tone(400, 0.5, { to: 80, gain: 0.06 }),
  enter: () => tone(400, 0.15, { type: "sine", to: 800, gain: 0.05 }),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { gain: 0.05, delay: i * 0.12 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, { type: "triangle", gain: 0.05, delay: i * 0.15 })),
};

export function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}
