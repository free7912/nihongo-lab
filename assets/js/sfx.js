// 音效：用 Web Audio 实时合成，不需要任何音频文件
import { getSettings, setSetting } from "./store.js";

let ctx = null;

function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function isMuted() {
  return !!getSettings().muted;
}

export function toggleMute() {
  const next = !isMuted();
  setSetting("muted", next);
  return next;
}

function tone(freq, delay, dur, { type = "sine", gain = 0.12 } = {}) {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const vol = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + delay;
  vol.gain.setValueAtTime(0.0001, t0);
  vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(vol).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function play(fn) {
  if (isMuted()) return;
  try {
    fn();
  } catch (err) {
    console.warn("音效播放失败", err);
  }
}

export const sfx = {
  click: () => play(() => tone(660, 0, 0.06, { type: "triangle", gain: 0.06 })),
  listen: () => play(() => {
    tone(520, 0, 0.09, { type: "sine", gain: 0.08 });
    tone(780, 0.08, 0.09, { type: "sine", gain: 0.06 });
  }),
  correct: (combo = 0) => play(() => {
    const base = 700 + Math.min(combo, 8) * 40;
    tone(base, 0, 0.1, { type: "triangle" });
    tone(base * 1.5, 0.08, 0.16, { type: "triangle" });
  }),
  wrong: () => play(() => {
    tone(220, 0, 0.18, { type: "sawtooth", gain: 0.09 });
    tone(170, 0.12, 0.22, { type: "sawtooth", gain: 0.08 });
  }),
  star: (i = 0) => play(() => tone(880 + i * 160, 0, 0.12, { type: "square", gain: 0.07 })),
  win: () => play(() => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, { type: "triangle", gain: 0.1 }));
  }),
  lose: () => play(() => {
    [392, 330, 262].forEach((f, i) => tone(f, i * 0.15, 0.3, { type: "sine", gain: 0.1 }));
  }),
  levelUp: () => play(() => {
    [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.25, { type: "square", gain: 0.07 }));
  }),
};
