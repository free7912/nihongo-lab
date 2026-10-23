// 影子跟读（Shadowing）
//
// 流程：听示范 → 跟着说 → 录下来 → 回放对比 → 自评「像不像」。
// 素材来自常用句（原创）与语法例句（带注音 + 人工中文），全部离线可用。
// 录音只存在浏览器内存里（Blob URL），离开页面即释放，不上传任何服务器。

import { shadowItems, pickSet, poolOf, SHADOW_SOURCES } from "../shadow-data.js";
import { speak, cancelSpeech, speechSupported } from "../speech.js";
import { VoiceRecorder, recorderSupported, estimateMs, moraCount } from "../recorder.js";
import { getSettings, setSetting, recordShadow, shadowStats, recordSkill, addXp } from "../store.js";
import { escapeHtml, LEVELS } from "../util.js";
import { sfx } from "../sfx.js";

const MODES = [
  { id: "repeat", label: "听后跟读", hint: "示范读完后，你再读一遍" },
  { id: "overlap", label: "同时跟读", hint: "示范一开始你就跟着说（真正的影子跟读）" },
  { id: "listen", label: "只听", hint: "先只听、不出声，熟悉节奏" },
];

export default async function mount(root) {
  const S = {
    level: LEVELS.includes(getSettings().level) ? getSettings().level : "N5",
    source: "all",
    bundle: null,
    set: [],
    idx: 0,
    rate: Number(getSettings().shadowRate) || 0.85,
    mode: getSettings().shadowMode || "repeat",
    hideText: false,
    recording: false,
    timing: false,
    micBlocked: false,
    busy: false,
    take: null,
    takeAudio: null,
    status: "",
    rated: [],
    done: false,
    alive: true,
    autoStop: 0,
    meterRaf: 0,
    live: [],
  };

  const rec = new VoiceRecorder();
  const supportsSpeech = speechSupported();
  const supportsRec = recorderSupported();

  /* ---------------- 数据 ---------------- */
  async function loadPool({ reset = true } = {}) {
    S.bundle = await shadowItems(S.level);
    if (!S.alive) return;
    if (reset) {
      S.set = pickSet(poolOf(S.bundle, S.source), 10);
      S.idx = 0;
      S.done = false;
      S.rated = [];
      clearTake();
    }
    render();
  }

  const item = () => S.set[S.idx] || null;

  /* ---------------- 录音 ---------------- */
  function clearTake() {
    if (S.take?.url) URL.revokeObjectURL(S.take.url);
    S.take = null;
    stopTakeAudio();
  }

  function stopTakeAudio() {
    if (S.takeAudio) {
      try {
        S.takeAudio.pause();
      } catch {
        /* 忽略 */
      }
      S.takeAudio = null;
    }
  }

  function playTake() {
    if (!S.take?.url) return;
    stopTakeAudio();
    const audio = new Audio(S.take.url);
    S.takeAudio = audio;
    audio.play().catch(() => {
      setStatus("浏览器拦住了自动播放，再点一次「听我的」。");
    });
    audio.onended = () => {
      if (S.takeAudio === audio) S.takeAudio = null;
    };
  }

  async function startRecording({ withModel = false } = {}) {
    if (S.recording || S.timing || S.busy || !item()) return;
    S.busy = true;
    const target = item();
    S.recordingId = target.id;

    if (!supportsRec) {
      S.micBlocked = true;
      S.busy = false;
      startTimedRepeat("浏览器不支持录音");
      return;
    }

    try {
      await rec.start();
      S.recording = true;
      S.busy = false;
      S.live = [];
      S.status = "● 录音中…放开嗓子跟一遍";
      render();
      startMeter();
      // 同时跟读：录音和示范一起开始
      if (withModel) speak(target.ja, { rate: S.rate });
      const ms = estimateMs(target.kana, S.rate) + 500;
      S.autoStop = setTimeout(() => stopRecording(), ms);
    } catch (err) {
      S.busy = false;
      S.micBlocked = true;
      const why =
        err?.name === "NotAllowedError"
          ? "麦克风权限被拒绝了"
          : err?.name === "NotFoundError"
            ? "没有找到可用麦克风"
            : "拿不到麦克风";
      startTimedRepeat(why);
    }
  }

  function startTimedRepeat(reason = "") {
    const target = item();
    if (!target) return;
    S.timing = true;
    S.status = reason
      ? `${reason}：已改用「计时跟读 + 自评」，照常练。`
      : "跟读中…（计时模式，不录音）";
    render();
    clearTimeout(S.autoStop);
    S.autoStop = setTimeout(() => {
      S.timing = false;
      render();
      setStatus("读完啦：自己判断一下像不像，再点下面的评分。");
    }, estimateMs(target.kana, S.rate));
  }

  async function stopRecording() {
    clearTimeout(S.autoStop);
    stopMeter();
    if (S.timing) {
      S.timing = false;
      render();
      return;
    }
    if (!S.recording) return;
    S.recording = false;
    S.status = "正在生成波形…";
    render();
    const take = await rec.stop();
    if (!S.alive || item()?.id !== S.recordingId) {
      if (take?.url) URL.revokeObjectURL(take.url);
      return;
    }
    if (!take || !take.blob.size) {
      setStatus("这段没录到声音，换个环境再来一次。");
      return;
    }
    clearTake();
    S.take = take;
    sfx.click();
    render();
    playTake();
    setStatus(`录到 ${(take.duration / 1000).toFixed(1)} 秒 · 先听听自己的，再点「听示范」对比`);
  }

  /* ---------------- 示范播放 ---------------- */
  function playModel({ thenRecord = false } = {}) {
    const target = item();
    if (!target) return;
    if (!supportsSpeech) {
      setStatus("这个浏览器没有语音合成，换 Chrome / Edge 试试（或者先自己读一遍再评分）。");
      return;
    }
    stopTakeAudio();
    sfx.listen();
    setStatus("示范播放中…");
    speak(target.ja, {
      rate: S.rate,
      onEnd: () => {
        if (!S.alive) return;
        if (S.recording) return;
        if (thenRecord) {
          setStatus("轮到你了…");
          setTimeout(() => S.alive && startRecording(), 320);
        } else {
          setStatus("听完了可以点「跟读录音」，或者再听一遍。");
        }
      },
    });
  }

  function compare() {
    const target = item();
    if (!target || !S.take) return;
    stopTakeAudio();
    setStatus("先听示范，再听你刚才的录音…");
    speak(target.ja, {
      rate: S.rate,
      onEnd: () => {
        if (!S.alive) return;
        setTimeout(() => {
          if (!S.alive) return;
          playTake();
          setStatus("这是我的录音，对比一下节奏和语调。");
        }, 420);
      },
    });
  }

  /* ---------------- 评分 / 翻页 ---------------- */
  function rate(stars) {
    const target = item();
    if (!target) return;
    if (S.mode === "listen") {
      setStatus("「只听」模式不计分，切到跟读模式再评分。");
      return;
    }
    recordShadow(target.id, stars, S.level);
    recordSkill("speaking", stars >= 2);
    const xp = stars === 3 ? 10 : stars === 2 ? 7 : 3;
    addXp(xp);
    if (stars >= 2) sfx.correct(stars);
    else sfx.wrong();
    S.rated.push({ id: target.id, stars });
    nextItem();
  }

  function nextItem() {
    clearTimeout(S.autoStop);
    stopMeter();
    if (S.recording) {
      S.recording = false;
      rec.stop().then((t) => t?.url && URL.revokeObjectURL(t.url));
    }
    cancelSpeech();
    stopTakeAudio();
    clearTake();
    if (S.idx + 1 >= S.set.length) {
      S.done = true;
      S.status = "";
      render();
      sfx.win();
      return;
    }
    S.idx += 1;
    S.status = "";
    render();
  }

  function setStatus(text) {
    S.status = text;
    const el = root.querySelector("#sh-status");
    if (el) el.textContent = text;
  }

  /* ---------------- 波形 ---------------- */
  function drawWave(peaks, { live = false } = {}) {
    const canvas = root.querySelector("#sh-wave");
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 640;
    const h = 84;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const line = css.getPropertyValue("--line").trim() || "#ddd";
    const brand = css.getPropertyValue("--brand").trim() || "#b7402f";
    const soft = css.getPropertyValue("--brand-soft").trim() || "#f6e3df";

    const mid = h / 2;
    g.strokeStyle = line;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(w, mid);
    g.stroke();

    if (peaks && peaks.length) {
      const n = peaks.length;
      const step = w / n;
      const barW = Math.max(2, step * 0.62);
      for (let i = 0; i < n; i++) {
        const v = peaks[i];
        const bh = Math.max(2, v * (h - 10));
        g.fillStyle = live ? soft : brand;
        g.globalAlpha = live ? 0.95 : 0.8;
        const x = i * step + (step - barW) / 2;
        g.beginPath();
        const r = barW / 2;
        g.roundRect ? g.roundRect(x, mid - bh / 2, barW, bh, r) : g.rect(x, mid - bh / 2, barW, bh);
        g.fill();
      }
      g.globalAlpha = 1;
      return;
    }

    // 没有录音时：画「节拍尺」，提示这句话大概几拍
    const target = item();
    const beats = target ? Math.min(48, Math.max(4, moraCount(target.kana))) : 12;
    const step = w / beats;
    g.fillStyle = line;
    for (let i = 0; i < beats; i++) {
      const bh = i % 4 === 0 ? 26 : 14;
      g.fillRect(i * step + step / 2 - 1, mid - bh / 2, 2, bh);
    }
    g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
    g.font = "11px system-ui, sans-serif";
    g.fillText(`${beats} 拍 · 点「听示范」或「跟读录音」开始`, 8, h - 6);
  }

  function startMeter() {
    cancelAnimationFrame(S.meterRaf);
    const loop = () => {
      if (!S.alive || !S.recording) return;
      S.live.push(rec.level());
      if (S.live.length > 96) S.live.shift();
      drawWave(S.live.length >= 4 ? S.live : [], { live: true });
      S.meterRaf = requestAnimationFrame(loop);
    };
    S.meterRaf = requestAnimationFrame(loop);
  }

  function stopMeter() {
    cancelAnimationFrame(S.meterRaf);
    S.meterRaf = 0;
  }

  /* ---------------- 渲染 ---------------- */
  function stats() {
    return shadowStats();
  }

  function render() {
    if (!S.alive) return;
    const st = stats();
    const target = item();
    const modeLabel = MODES.find((m) => m.id === S.mode)?.label || "";
    const showRate = S.mode !== "listen";

    root.innerHTML = `
      <div class="sh-page">
        <section class="sh-hero">
          <div class="sh-hero-main">
            <span class="sh-kicker">SHADOWING</span>
            <h1>影子跟读</h1>
            <p class="sh-sub">听一句、跟一句，用自己的声音去对齐节奏和语调。录音只留在本机内存，离开页面就没了。</p>
          </div>
          <div class="sh-hero-stats">
            <div class="sh-stat"><b>${st.today}</b><span>今日跟读</span></div>
            <div class="sh-stat"><b>${st.total}</b><span>累计句数</span></div>
            <div class="sh-stat"><b>${st.best3}</b><span>很像的句子</span></div>
          </div>
        </section>

        <div class="sh-toolbar">
          <div class="sh-tool">
            <span class="sh-label">等级</span>
            <div class="chips">
              ${LEVELS.map(
                (lv) =>
                  `<button class="chip ${lv === S.level ? "active" : ""}" data-act="level" data-value="${lv}" aria-pressed="${lv === S.level}">${lv}</button>`
              ).join("")}
            </div>
          </div>
          <div class="sh-tool">
            <span class="sh-label">素材</span>
            <div class="chips">
              ${SHADOW_SOURCES.map(
                (s) =>
                  `<button class="chip ${s.id === S.source ? "active" : ""}" data-act="source" data-value="${s.id}" aria-pressed="${s.id === S.source}">${s.label}</button>`
              ).join("")}
            </div>
          </div>
          <div class="sh-tool sh-speed">
            <span class="sh-label">语速 <b id="sh-rate-label">${S.rate.toFixed(2)}×</b></span>
            <input id="sh-rate" type="range" min="0.6" max="1.15" step="0.05" value="${S.rate}" aria-label="语速">
          </div>
          <div class="sh-tool sh-tool-end">
            <button class="btn sm ghost" data-act="shuffle">🔀 打乱顺序</button>
            <button class="btn sm ghost" data-act="reload">↻ 换一批</button>
          </div>
        </div>

        ${
          S.done
            ? renderSummary()
            : target
              ? renderStage(target, modeLabel, showRate)
              : `<div class="card empty">这个筛选下还没有句子，换一个等级或素材试试。</div>`
        }

        <details class="card sh-tips">
          <summary>影子跟读怎么做才有效？</summary>
          <ol class="sh-tips-list">
            <li><b>先听一遍</b>：不看书、不出声，只注意停顿和起伏。</li>
            <li><b>跟着说</b>：比示范慢半拍开始，尽量保持同样的节奏，不要一个词一个词念。</li>
            <li><b>录下来对比</b>：先听示范、再听自己的录音，找「哪里拖了、哪里太重」。</li>
            <li><b>再来一次</b>：同一句练 3 遍，比刷 10 句新的更有效。</li>
          </ol>
          <p class="meta">小提示：麦克风只在点「跟读录音」时才打开；「只听」模式不会录音，也不计分。
          ${supportsSpeech ? "" : "当前浏览器没有语音合成，示范可能没法播。"}</p>
        </details>
      </div>`;

    bind();
    drawWave(S.take?.peaks || null);
  }

  function renderStage(target, modeLabel, showRate) {
    const total = S.set.length;
    const pct = Math.round(((S.idx + (S.done ? 1 : 0)) / total) * 100);
    const srcLabel = target.source === "phrase" ? "常用句" : "语法例句";
    return `
      <section class="sh-stage">
        <div class="sh-stage-top">
          <span class="badge lv-${S.level.toLowerCase()}">${S.level}</span>
          <span class="tag">${srcLabel}</span>
          <span class="sh-counter">${S.idx + 1} / ${total}</span>
          <span class="spacer"></span>
          <div class="sh-modes" role="group" aria-label="跟读模式">
            ${MODES.map(
              (m) =>
                `<button class="sh-mode ${m.id === S.mode ? "on" : ""}" data-act="mode" data-value="${m.id}" title="${escapeHtml(m.hint)}" aria-pressed="${m.id === S.mode}">${m.label}</button>`
            ).join("")}
          </div>
        </div>

        <div class="progress slim"><i style="width:${pct}%"></i></div>

        <div class="sh-sentence ${S.hideText ? "blurred" : ""}">
          <div class="sh-ja ja" id="sh-ja">${target.ruby}</div>
          <div class="sh-reading ja">${escapeHtml(target.kana)}</div>
          <div class="sh-zh">${escapeHtml(target.zh)}</div>
          <div class="sh-note">${escapeHtml(target.note || "")} · ${target.mora} 拍</div>
        </div>

        <div class="sh-controls">
          <button class="btn primary" data-act="play">🔊 听示范</button>
          <button class="btn accent ${S.recording ? "is-rec" : ""}" data-act="record" ${S.recording || S.timing ? "disabled" : ""}>
            ${S.recording ? "● 录音中…" : S.timing ? "● 跟读中…" : "🎤 跟读录音"}
          </button>
          <button class="btn ghost" data-act="stop" ${S.recording || S.timing ? "" : "disabled"}>⏹ 停止</button>
          <button class="btn ghost" data-act="mine" ${S.take ? "" : "disabled"}>▶ 听我的</button>
          <button class="btn ghost" data-act="compare" ${S.take ? "" : "disabled"}>⇄ 对比</button>
          <button class="btn ghost sm" data-act="hide">${S.hideText ? "👁 显示原文" : "🙈 遮住原文"}</button>
        </div>

        <div class="sh-visual">
          <canvas id="sh-wave" class="sh-wave" height="84"></canvas>
          <div class="sh-status" id="sh-status" aria-live="polite">${escapeHtml(S.status || defaultHint())}</div>
        </div>

        ${
          showRate
            ? `<div class="sh-rate-row">
                 <span class="sh-rate-q">这次像吗？</span>
                 <button class="sh-rate r3" data-act="rate" data-value="3">😀 很像</button>
                 <button class="sh-rate r2" data-act="rate" data-value="2">🙂 还行</button>
                 <button class="sh-rate r1" data-act="rate" data-value="1">😅 不太像</button>
                 <span class="spacer"></span>
                 <button class="btn sm ghost" data-act="next">跳过 / 下一句 →</button>
               </div>`
            : `<div class="sh-rate-row"><span class="meta">「只听」模式：不计分。切到「听后跟读」就能评分。</span>
                 <span class="spacer"></span><button class="btn sm ghost" data-act="next">下一句 →</button></div>`
        }

        <div class="sh-kbd meta">快捷键：<kbd>空格</kbd> 听示范 · <kbd>R</kbd> 跟读录音 · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 评分 · <kbd>N</kbd> 下一句</div>
      </section>`;
  }

  function defaultHint() {
    if (S.mode === "overlap") return "点「跟读录音」：示范和录音会同时开始。";
    if (S.mode === "listen") return "点「听示范」，先把节奏听熟。";
    return "点「听示范」→ 停一拍 → 跟着读，再听听自己的录音。";
  }

  function renderSummary() {
    const counts = [0, 0, 0, 0];
    S.rated.forEach((r) => (counts[r.stars] = (counts[r.stars] || 0) + 1));
    const n = S.rated.length;
    return `
      <section class="card sh-done">
        <div class="sh-done-emoji">🎉</div>
        <h2>这一组完成啦</h2>
        <p class="sh-sub">${S.level} · ${n} 句 · 很像 ${counts[3] || 0} · 还行 ${counts[2] || 0} · 不太像 ${counts[1] || 0}</p>
        <div class="sh-done-actions">
          <button class="btn primary" data-act="reload">再来一组</button>
          <button class="btn" data-act="level" data-value="${nextLevel()}">换个等级 → ${nextLevel()}</button>
        </div>
        <p class="meta">同一批句子过几天再练一次，效果比一直换新句子好。</p>
      </section>`;
  }

  function nextLevel() {
    const i = LEVELS.indexOf(S.level);
    return LEVELS[(i + 1) % LEVELS.length];
  }

  /* ---------------- 绑定 ---------------- */
  function bind() {
    const rateInput = root.querySelector("#sh-rate");
    rateInput?.addEventListener("input", () => {
      S.rate = Number(rateInput.value);
      const label = root.querySelector("#sh-rate-label");
      if (label) label.textContent = `${S.rate.toFixed(2)}×`;
    });
    rateInput?.addEventListener("change", () => setSetting("shadowRate", S.rate));
  }

  function onClick(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn || !root.contains(btn)) return;
    const act = btn.dataset.act;
    const value = btn.dataset.value;

    if (act === "level") {
      if (value === S.level) return;
      S.level = value;
      S.done = false;
      loadPool();
      return;
    }
    if (act === "source") {
      if (value === S.source) return;
      S.source = value;
      S.set = pickSet(poolOf(S.bundle, S.source), 10);
      S.idx = 0;
      S.done = false;
      S.rated = [];
      clearTake();
      render();
      return;
    }
    if (act === "mode") {
      S.mode = value;
      S.status = "";
      setSetting("shadowMode", value);
      render();
      return;
    }
    if (act === "shuffle" || act === "reload") {
      setStatus("换一批…");
      S.set = pickSet(poolOf(S.bundle, S.source), 10);
      S.idx = 0;
      S.done = false;
      S.rated = [];
      clearTake();
      render();
      return;
    }
    if (act === "play") return playModel();
    if (act === "record") {
      if (S.mode === "overlap") startRecording({ withModel: true });
      else {
        playModel({ thenRecord: true });
      }
      return;
    }
    if (act === "stop") {
      clearTimeout(S.autoStop);
      if (S.recording) stopRecording();
      if (S.timing) {
        S.timing = false;
        render();
      }
      return;
    }
    if (act === "mine") return playTake();
    if (act === "compare") return compare();
    if (act === "hide") {
      S.hideText = !S.hideText;
      render();
      return;
    }
    if (act === "rate") return rate(Number(value));
    if (act === "next") return nextItem();
  }

  function onKey(e) {
    if (e.target.closest("input, textarea, select")) return;
    if (S.done) return;
    if (e.code === "Space") {
      // 焦点在按钮/链接上时交给浏览器自己触发，避免一次空格播放两遍
      if (e.target.closest("button, a, summary")) return;
      e.preventDefault();
      playModel();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      if (S.recording) stopRecording();
      else if (S.mode === "overlap") startRecording({ withModel: true });
      else playModel({ thenRecord: true });
    } else if (["1", "2", "3"].includes(e.key)) {
      rate(Number(e.key));
    } else if (e.key === "n" || e.key === "N") {
      nextItem();
    }
  }

  /* ---------------- 生命周期 ---------------- */
  root.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  await loadPool();

  return function cleanup() {
    S.alive = false;
    clearTimeout(S.autoStop);
    stopMeter();
    cancelSpeech();
    stopTakeAudio();
    clearTake();
    rec.close();
    root.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
