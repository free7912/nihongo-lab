// 日语语音识别 + 相似度打分
//
// 使用浏览器内置的 Web Speech API（Chrome / Edge 支持最好）。
// 识别结果可能是汉字（例：「私は学生です」），也可能全是假名，
// 所以打分时同时与「汉字原文」和「假名读法」比较，取较高分。

const SR = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export function recognitionSupported() {
  return !!SR;
}

/** 片假名 → 平假名 */
export function kataToHira(str) {
  return String(str).replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** 归一化：去标点/空白，片假名转平假名 */
export function normalizeJa(str) {
  return kataToHira(
    String(str || "")
      .replace(/[\s\u3000]/g, "")
      .replace(/[。、，．,.！!？?「」『』（）()・…—–~「」【】:：;；"'"'・]/g, "")
      .replace(/[ー－-]/g, "")
  ).toLowerCase();
}

/** 编辑距离 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0~1 相似度 */
export function similarity(a, b) {
  const x = normalizeJa(a);
  const y = normalizeJa(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/**
 * 给一次朗读打分
 * @param {{ja?:string, kana?:string}} target 目标句/词
 * @param {string} transcript 识别结果
 * @returns {{score:number, stars:number, passed:boolean}}
 */
export function scoreAttempt(target, transcript) {
  const candidates = [target.ja, target.kana].filter(Boolean);
  const score = candidates.reduce((best, c) => Math.max(best, similarity(c, transcript)), 0);
  const stars = score >= 0.9 ? 3 : score >= 0.72 ? 2 : score >= 0.55 ? 1 : 0;
  return { score, stars, passed: stars > 0 };
}

let active = null;

/**
 * 听一次（说一句）。返回 { transcript, alternatives }
 * 不支持时 reject。
 */
export function listenOnce({ lang = "ja-JP", timeoutMs = 9000 } = {}) {
  if (!SR) return Promise.reject(new Error("unsupported"));
  if (active) {
    try {
      active.abort();
    } catch {
      /* ignore */
    }
    active = null;
  }

  return new Promise((resolve, reject) => {
    const rec = new SR();
    active = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false;

    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (active === rec) active = null;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      fn(arg);
    };

    const timer = setTimeout(() => finish(reject, new Error("timeout")), timeoutMs);

    rec.onresult = (event) => {
      const alternatives = [];
      const res = event.results[event.results.length - 1];
      for (let i = 0; i < res.length; i++) alternatives.push(res[i].transcript.trim());
      finish(resolve, { transcript: alternatives[0] || "", alternatives });
    };
    rec.onerror = (e) => finish(reject, new Error(e.error || "recognition-error"));
    rec.onend = () => finish(resolve, { transcript: "", alternatives: [] });

    try {
      rec.start();
    } catch (err) {
      finish(reject, err);
    }
  });
}

export function stopListening() {
  if (active) {
    try {
      active.abort();
    } catch {
      /* ignore */
    }
    active = null;
  }
}
