// 录音 + 波形：影子跟读用
//
// 只用浏览器原生能力（getUserMedia / MediaRecorder / Web Audio），不引入任何库。
// 拿不到麦克风时由调用方降级成「计时跟读 + 自评」，不影响功能可用性。

export function recorderSupported() {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    window.MediaRecorder
  );
}

/** 数一下「拍」数（モーラ）：拗音、小写元音不算独立一拍 */
export function moraCount(kana) {
  const chars = [...String(kana || "")].filter((ch) => /[\u3041-\u309f\u30a0-\u30ffー]/.test(ch));
  const small = /[ゃゅょぁぃぅぇぉゎ]/;
  const n = chars.filter((ch) => !small.test(ch)).length;
  return n || String(kana || "").length;
}

/** 估算一句话的正常朗读时长（毫秒），用来决定自动停止录音的时机 */
export function estimateMs(kana, rate = 0.85) {
  const r = Math.min(1.5, Math.max(0.4, Number(rate) || 0.85));
  const ms = (moraCount(kana) * 165) / r + 900;
  return Math.round(Math.min(15000, Math.max(1800, ms)));
}

/** 把一段音频采样压成 buckets 个 0~1 的峰值（图形用） */
export function peaksFromChannel(data, buckets = 96) {
  const n = Math.max(1, Math.floor(buckets));
  if (!data || !data.length) return new Array(n).fill(0);
  const block = Math.max(1, Math.floor(data.length / n));
  const out = [];
  for (let i = 0; i < n; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block && start + j < data.length; j++) {
      const v = Math.abs(data[start + j]);
      if (v > max) max = v;
    }
    out.push(max);
  }
  const peak = Math.max(...out, 1e-9);
  return out.map((v) => Math.min(1, v / peak));
}

/** 解码录音 → 峰值数组（失败时返回空数组，不抛错） */
export async function decodePeaks(blob, buckets = 96) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !blob) return [];
  const ctx = new AC();
  try {
    const buffer = await blob.arrayBuffer();
    const audio = await new Promise((resolve, reject) => {
      const ret = ctx.decodeAudioData(buffer, resolve, reject);
      if (ret && typeof ret.then === "function") ret.then(resolve, reject);
    });
    return peaksFromChannel(audio.getChannelData(0), buckets);
  } catch {
    return [];
  } finally {
    try {
      ctx.close();
    } catch {
      /* 忽略 */
    }
  }
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export class VoiceRecorder {
  constructor() {
    this.stream = null;
    this.rec = null;
    this.chunks = [];
    this.startedAt = 0;
    this.mime = "";
    this.analyser = null;
    this.ctx = null;
    this.buf = null;
  }

  get recording() {
    return !!this.rec;
  }

  async open() {
    if (this.stream) return this.stream;
    if (!recorderSupported()) throw new Error("unsupported");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    return this.stream;
  }

  async start() {
    const stream = await this.open();
    this.chunks = [];
    const mime = MIME_CANDIDATES.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || "";
    this.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    this.mime = this.rec.mimeType || mime || "audio/webm";
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    this.rec.start(100);
    this.startedAt = performance.now();
    return true;
  }

  /** 停止并返回 { blob, url, duration, peaks }；没在录时返回 null */
  async stop() {
    if (!this.rec) return null;
    const rec = this.rec;
    const mime = this.mime;
    const blob = await new Promise((resolve) => {
      const done = () => resolve(new Blob(this.chunks, { type: mime }));
      rec.onstop = done;
      try {
        rec.stop();
      } catch {
        done();
      }
      setTimeout(done, 1500); // 兜底：某些浏览器 onstop 不触发
    });
    this.rec = null;
    const duration = Math.max(0, Math.round(performance.now() - this.startedAt));
    const peaks = await decodePeaks(blob, 96);
    return { blob, url: URL.createObjectURL(blob), duration, peaks, mime };
  }

  /** 当前音量 0~1（录音时的实时波形/电平用） */
  level() {
    if (!this.stream) return 0;
    try {
      if (!this.analyser) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return 0;
        this.ctx = new AC();
        const src = this.ctx.createMediaStreamSource(this.stream);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        src.connect(this.analyser);
        this.buf = new Uint8Array(this.analyser.fftSize);
      }
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) {
        const v = (this.buf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / this.buf.length) * 3.2);
    } catch {
      return 0;
    }
  }

  close() {
    try {
      this.rec?.state === "recording" && this.rec.stop();
    } catch {
      /* 忽略 */
    }
    this.rec = null;
    this.stream?.getTracks?.().forEach((t) => t.stop());
    this.stream = null;
    try {
      this.ctx?.close();
    } catch {
      /* 忽略 */
    }
    this.ctx = null;
    this.analyser = null;
  }
}
