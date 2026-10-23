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

export function cancelSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* 忽略 */
  }
}

/**
 * 朗读日语。
 * onEnd 在「读完 / 被取消 / 出错」时都会调用一次，方便跟读功能排「读→录」的时序。
 * 返回值是 utterance（不支持时返回 null）。
 */
export function speak(text, { rate, onEnd, onStart, onError } = {}) {
  if (!speechSupported() || !text) {
    if (typeof onEnd === "function") setTimeout(onEnd, 0);
    return null;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = "ja-JP";
  if (!preferred) refreshVoices();
  if (preferred) u.voice = preferred;
  const base = rate ?? getSettings().speechRate ?? 0.85;
  u.rate = Math.min(1.5, Math.max(0.4, Number(base) || 0.85));
  u.pitch = 1;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (typeof onEnd === "function") onEnd();
  };
  u.onstart = () => {
    if (typeof onStart === "function") onStart();
  };
  u.onend = finish;
  u.onerror = (e) => {
    if (typeof onError === "function") onError(e);
    finish();
  };

  synth.speak(u);
  return u;
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
