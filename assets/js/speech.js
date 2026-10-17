// 日语发音：使用浏览器内置语音合成（无需音频文件）
import { getSettings } from "./store.js";

let voices = [];
let preferred = null;

function refreshVoices() {
  voices = window.speechSynthesis?.getVoices?.() || [];
  preferred =
    voices.find((v) => v.lang === "ja-JP" && /kyoko|otoya|nanami|google/i.test(v.name)) ||
    voices.find((v) => v.lang === "ja-JP") ||
    voices.find((v) => v.lang?.startsWith("ja")) ||
    null;
}

if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

export function speechSupported() {
  return "speechSynthesis" in window;
}

export function hasJapaneseVoice() {
  if (!preferred) refreshVoices();
  return !!preferred;
}

export function speak(text, { rate } = {}) {
  if (!speechSupported() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = "ja-JP";
  if (!preferred) refreshVoices();
  if (preferred) u.voice = preferred;
  u.rate = rate ?? getSettings().speechRate ?? 0.85;
  u.pitch = 1;
  synth.speak(u);
}

export function installSpeakHandler(root = document) {
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-speak]");
    if (!btn) return;
    e.preventDefault();
    speak(btn.dataset.speak);
    btn.classList.add("speaking");
    setTimeout(() => btn.classList.remove("speaking"), 600);
  });
}
