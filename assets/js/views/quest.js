import {
  levelInfo,
  addXp,
  stageResult,
  saveStageResult,
  totalStars,
  awardAchievement,
  achievementList,
  recordSkill,
  skillStats,
  getSettings,
  setSetting,
} from "../store.js";
import { chapterPlan, LEVEL_ORDER, buildStage } from "../quest-engine.js";
import { ACHIEVEMENTS } from "../quest-data.js";
import { escapeHtml } from "../util.js";
import { speak } from "../speech.js";
import { sfx, isMuted, toggleMute } from "../sfx.js";
import { recognitionSupported, listenOnce, stopListening, scoreAttempt } from "../speech-recog.js";

const HEARTS = 3;
const RETRY_LIMIT = 2;

export default async function mount(root) {
  let levelTab = getSettings().questLevel && LEVEL_ORDER.includes(getSettings().questLevel)
    ? getSettings().questLevel
    : "N5";
  let run = null;
  let listening = false;
  let recognizerAvailable = recognitionSupported();
  let recogFailures = 0;
  let feedback = null;
  let showText = getSettings().questShowText !== false;

  /* ---------------- 解锁判定 ---------------- */
  const bossId = (level) => `${level.toLowerCase()}-mixed-1`;

  function isLevelUnlocked(level) {
    const idx = LEVEL_ORDER.indexOf(level);
    if (idx <= 0) return true;
    return (stageResult(bossId(LEVEL_ORDER[idx - 1]))?.stars || 0) > 0;
  }

  function unlockedInLevel(plan, i) {
    if (i === 0) return true;
    return (stageResult(plan[i - 1].id)?.stars || 0) > 0;
  }

  /* ---------------- 关卡地图 ---------------- */
  function renderMap() {
    stopListening();
    listening = false;
    run = null;
    const info = levelInfo();
    const plan = chapterPlan(levelTab);
    const unlocked = isLevelUnlocked(levelTab);
    const skills = skillStats();

    root.innerHTML = `
      <div class="row">
        <h1 style="margin:0">闯关路线</h1>
        <span class="spacer"></span>
        <span class="tag">总星数 ${totalStars()}</span>
        <button class="btn sm" id="mute">${isMuted() ? "🔇" : "🔊"}</button>
      </div>
      <p style="color:var(--muted);margin-top:4px">一条从 N5 到 N1 的主线：单词 → 汉字 → 语法 → 口语 → 综合试炼，每关都要靠实力解锁下一关。</p>

      <div class="card" style="margin:12px 0">
        <div class="row">
          <div class="level-orb">Lv<span>${info.level}</span></div>
          <div style="flex:1;min-width:170px">
            <div class="row" style="gap:6px">
              <b>经验 ${info.xp}</b>
              <span class="spacer"></span>
              <span class="tag">再得 ${info.need - info.into} XP 升级</span>
            </div>
            <div class="progress" style="margin-top:6px"><i style="width:${info.pct}%"></i></div>
          </div>
        </div>
        <div class="skl-list">
          ${skills
            .map(
              (s) => `<div class="skl">
                <div class="row" style="gap:4px"><span>${s.emoji}</span><b>${s.label}</b>
                  <span class="spacer"></span><span class="tag">Lv${s.level}</span></div>
                <div class="progress slim"><i style="width:${s.pct}%"></i></div>
                <div class="meta">练过 ${s.seen} 题 · 正确率 ${(s.accuracy * 100).toFixed(0)}%</div>
              </div>`
            )
            .join("")}
        </div>
      </div>

      <div class="chips" style="margin-bottom:12px">
        ${LEVEL_ORDER.map((lv) => {
          const ok = isLevelUnlocked(lv);
          return `<button class="btn sm ${lv === levelTab ? "active" : ""}" data-level="${lv}" ${ok ? "" : "disabled"}
            title="${ok ? "" : "先通关上一等级的试炼"}">${ok ? "" : "🔒 "}${lv}</button>`;
        }).join("")}
      </div>

      ${
        unlocked
          ? `<div class="path">
              ${plan
                .map((stage, i) => stageNode(stage, i, plan))
                .join("")}
            </div>`
          : `<div class="card empty">🔒 ${levelTab} 需要先通关 ${LEVEL_ORDER[LEVEL_ORDER.indexOf(levelTab) - 1]} 的综合试炼。</div>`
      }

      ${
        achievementList().length
          ? `<div class="card" style="margin-top:16px">
              <div class="card-head"><h3>徽章</h3></div>
              <div class="chips">
                ${ACHIEVEMENTS.filter((a) => achievementList().includes(a.id))
                  .map((a) => `<span class="badge" title="${escapeHtml(a.desc)}">${a.emoji} ${escapeHtml(a.label)}</span>`)
                  .join("")}
              </div>
            </div>`
          : ""
      }
    `;

    root.querySelector("#mute").addEventListener("click", () => {
      toggleMute();
      renderMap();
    });
  }

  function stageNode(stage, i, plan) {
    const res = stageResult(stage.id);
    const stars = res?.stars || 0;
    const open = unlockedInLevel(plan, i);
    const isNext = open && !stars && plan.findIndex((s) => (stageResult(s.id)?.stars || 0) === 0) === i;
    return `
      <div class="stage-node ${stage.boss ? "boss" : ""} ${open ? "" : "locked"} ${stars ? "cleared" : ""} ${isNext ? "current" : ""}">
        <div class="node-icon">${open ? stage.emoji : "🔒"}</div>
        <div class="node-body">
          <div class="row" style="gap:8px">
            <b class="ja">${escapeHtml(stage.title)}</b>
            ${stage.boss ? `<span class="badge lv-${stage.level.toLowerCase()}">试炼</span>` : ""}
            <span class="spacer"></span>
            <span class="stars">${[0, 1, 2].map((s) => (s < stars ? "★" : "☆")).join("")}</span>
          </div>
          <div class="meta" style="color:var(--muted)">${escapeHtml(stage.desc)} · ${stage.count} 题${
            res ? ` · 最高 ${res.best} 分 · 已挑战 ${res.plays} 次` : ""
          }</div>
        </div>
        <button class="btn ${stars ? "" : "primary"}" data-stage="${stage.id}" ${open ? "" : "disabled"}>
          ${open ? (stars ? "再挑战" : "开始") : "未解锁"}
        </button>
      </div>`;
  }

  /* ---------------- 开始一关 ---------------- */
  async function startStage(stageId) {
    const stage = chapterPlan(levelTab).find((s) => s.id === stageId);
    if (!stage) return;
    root.innerHTML = `<h1>${escapeHtml(stage.title)}</h1><div class="loading">正在准备题目…</div>`;
    let questions = [];
    try {
      questions = await buildStage(stage);
    } catch (err) {
      console.error(err);
      root.innerHTML = `<div class="card"><h2>题目加载失败</h2><p style="color:var(--muted)">${escapeHtml(
        String(err.message || err)
      )}</p><button class="btn" id="back">返回地图</button></div>`;
      root.querySelector("#back").addEventListener("click", renderMap);
      return;
    }
    if (!questions.length) {
      root.innerHTML = `<div class="card empty">这一关暂时没有可用题目。</div>`;
      return;
    }
    run = {
      stage,
      questions,
      index: 0,
      hearts: HEARTS,
      mistakes: 0,
      combo: 0,
      maxCombo: 0,
      correct: 0,
      xp: 0,
      answers: [],
      tries: 0,
      answered: false,
    };
    feedback = null;
    sfx.click();
    renderQuestion();
  }

  /* ---------------- 出题 ---------------- */
  function renderQuestion() {
    if (!run) return renderMap();
    const q = run.questions[run.index];
    const total = run.questions.length;

    root.innerHTML = `
      <div class="row" style="margin-bottom:6px">
        <button class="btn sm ghost" id="quit">← 地图</button>
        <span class="spacer"></span>
        <span class="skill-tag">${skillEmoji(q.skill)} ${skillLabel(q.skill)}</span>
        <span class="hearts">${[0, 1, 2].map((i) => (i < run.hearts ? "❤️" : "🖤")).join("")}</span>
        ${run.combo >= 2 ? `<span class="combo">🔥 ×${run.combo}</span>` : ""}
        <span class="tag">${run.index + 1}/${total}</span>
      </div>
      <div class="progress" style="margin-bottom:14px"><i style="width:${(run.index / total) * 100}%"></i></div>

      <div class="card quest-card">
        <div class="meta" style="color:var(--muted)">${escapeHtml(run.stage.title)}</div>
        ${
          q.type === "listen"
            ? `<div class="listen-box">
                 <button class="listen-btn" id="replay">🔊</button>
                 <div class="meta" style="color:var(--muted)">听发音，选出正确的词</div>
               </div>`
            : `<div class="q-prompt">${q.promptHtml}</div>`
        }
        ${q.promptSubHtml ? `<div class="q-sub">${q.promptSubHtml}</div>` : ""}
        ${q.type !== "speak" && q.speakText ? `<div class="row" style="justify-content:center"><button class="btn sm ghost" id="say">🔊 发音</button></div>` : ""}

        <div id="answer-area">${renderAnswerArea(q)}</div>
      </div>
    `;

    root.querySelector("#quit").addEventListener("click", () => {
      stopListening();
      renderMap();
    });
    root.querySelector("#replay")?.addEventListener("click", () => speak(q.speakText));
    root.querySelector("#say")?.addEventListener("click", () => speak(q.speakText));
    bindAnswerArea(q);

    if (q.type === "listen") speak(q.speakText);
  }

  function renderAnswerArea(q) {
    if (q.type === "speak") {
      return `
        ${
          showText
            ? `<div class="quest-target">
                 <div class="ja">${escapeHtml(q.target.ja)}</div>
                 ${q.target.kana && q.target.kana !== q.target.ja ? `<div class="kana-line">${escapeHtml(q.target.kana)}</div>` : ""}
                 ${q.target.romaji ? `<div class="romaji-line">${escapeHtml(q.target.romaji)}</div>` : ""}
               </div>`
            : `<div class="quest-target"><div class="ja">???</div>
                 <div class="meta" style="color:var(--muted)">先自己说一遍，再点「显示答案」核对</div></div>`
        }
        <div class="row" style="justify-content:center;margin-top:6px">
          <button class="btn sm" id="demo">🔊 听示范</button>
          <button class="btn sm ghost" id="toggle-text">${showText ? "🙈 隐藏原文" : "👁 显示答案"}</button>
        </div>
        <div class="mic-area">
          ${
            listening
              ? `<button class="mic listening" id="mic">🎙️</button><div class="mic-hint">正在听…请朗读</div>`
              : `<button class="mic" id="mic">🎤</button>
                 <div class="mic-hint">${
                   recognizerAvailable && recogFailures < 2 ? "点击麦克风，然后朗读" : "点击麦克风，跟读后自己判断"
                 }</div>`
          }
        </div>
        <div id="feedback">${renderFeedback(q)}</div>`;
    }

    return `
      <div class="options">
        ${q.options
          .map(
            (o, i) => `<button class="option" data-opt="${i}">
              <span class="opt-key">${i + 1}</span><span class="opt-text ja">${escapeHtml(o.text)}</span>
            </button>`
          )
          .join("")}
      </div>
      <div id="feedback">${renderExplain(q)}</div>`;
  }

  function renderExplain(q) {
    if (!run.answered) return "";
    const last = run.answers[run.answers.length - 1];
    if (!last) return "";
    return `<div class="feedback ${last.correct ? "ok" : "ng"}">
      <div class="row">
        <b style="color:${last.correct ? "var(--green)" : "var(--accent)"}">${last.correct ? "答对了 +" + last.gain + " XP" : "答错了"}</b>
        <span class="spacer"></span>
        <button class="btn ${last.correct ? "primary" : ""}" id="next">${run.index + 1 >= run.questions.length ? "结算 →" : "下一题 →"}</button>
      </div>
      <p class="meta" style="margin:8px 0 0">${escapeHtml(q.explain || "")}</p>
    </div>`;
  }

  function renderFeedback(q) {
    if (!feedback) return "";
    if (feedback.type === "self") {
      return `<div class="feedback">
        <p class="meta" style="color:var(--muted);margin:0">${escapeHtml(feedback.message || "")}</p>
        <div class="row" style="margin-top:10px">
          <button class="btn primary" id="self-ok">✔ 我读对了</button>
          <button class="btn" id="self-again">↻ 再读一次</button>
        </div>
      </div>`;
    }
    const { score, stars, transcript, message } = feedback;
    const color = stars === 3 ? "var(--green)" : stars >= 1 ? "var(--indigo)" : "var(--accent)";
    return `<div class="feedback ${stars >= 1 ? "ok" : "ng"}">
      <div class="row">
        <b style="color:${color}">${stars >= 1 ? "通过" : "再试一次"} · ${(score * 100).toFixed(0)} 分</b>
        <span class="stars">${[0, 1, 2].map((s) => (s < stars ? "★" : "☆")).join("")}</span>
        <span class="spacer"></span>
        <span class="tag">${feedback.source === "self" ? "自评模式" : "语音识别"}</span>
      </div>
      ${message ? `<p class="meta" style="color:var(--muted);margin:6px 0 0">${escapeHtml(message)}</p>` : ""}
      ${transcript ? `<p class="meta" style="color:var(--muted);margin:6px 0 0">我听到：<span class="ja">${escapeHtml(transcript)}</span></p>` : ""}
      <div class="row" style="margin-top:10px">
        <button class="btn" id="again" ${run.tries >= RETRY_LIMIT ? "disabled" : ""}>↻ 再试一次${
          run.tries >= RETRY_LIMIT ? "（次数用完）" : ""
        }</button>
        <button class="btn ${stars >= 1 ? "primary" : ""}" id="next">${stars >= 1 ? "下一题 →" : "跳过这题"}</button>
      </div>
    </div>`;
  }

  /* ---------------- 交互绑定 ---------------- */
  function bindAnswerArea(q) {
    if (q.type === "speak") {
      root.querySelector("#demo")?.addEventListener("click", () => {
        sfx.listen();
        speak(q.speakText);
      });
      root.querySelector("#toggle-text")?.addEventListener("click", () => {
        if (listening) return;
        showText = !showText;
        setSetting("questShowText", showText);
        renderQuestion();
      });
      root.querySelector("#mic")?.addEventListener("click", startListen);
      root.querySelector("#self-ok")?.addEventListener("click", () => {
        feedback = { ...feedback, score: 0.8, stars: 2, source: "self" };
        gradeSpeak(q, 2, false);
      });
      root.querySelector("#self-again")?.addEventListener("click", () => {
        feedback = null;
        run.tries += 1;
        renderQuestion();
        speak(q.speakText);
      });
      root.querySelector("#again")?.addEventListener("click", () => {
        feedback = null;
        run.tries += 1;
        renderQuestion();
        speak(q.speakText);
      });
      root.querySelector("#next")?.addEventListener("click", () => {
        // 识别通过但还没计分：先让学习者看到识别结果，点「下一题」才真正记分前进
        if (run && !run.answered && feedback && (feedback.stars || 0) >= 1) return gradeSpeak(q, feedback.stars, false);
        nextQuestion(true);
      });
      return;
    }

    const options = [...root.querySelectorAll("[data-opt]")];
    options.forEach((btn) =>
      btn.addEventListener("click", () => {
        if (run.answered) return;
        const idx = Number(btn.dataset.opt);
        const opt = q.options[idx];
        run.answered = true;
        options.forEach((b) => {
          const o = q.options[Number(b.dataset.opt)];
          if (o.correct) b.classList.add("correct");
        });
        if (!opt.correct) btn.classList.add("wrong");
        const gain = markAnswer(q, opt.correct);
        if (opt.correct) {
          sfx.correct(run.combo);
          const fb = root.querySelector("#feedback");
          fb.innerHTML = renderExplain(q);
          bindExplain(q);
          setTimeout(() => {
            if (run && run.answered) nextQuestion();
          }, 800);
        } else {
          sfx.wrong();
          renderFeedbackPanel(q, gain);
        }
      })
    );
  }

  function bindExplain(q) {
    root.querySelector("#next")?.addEventListener("click", nextQuestion);
  }

  function renderFeedbackPanel(q) {
    const fb = root.querySelector("#feedback");
    fb.innerHTML = renderExplain(q);
    bindExplain(q);
    if (run && run.hearts <= 0) setTimeout(() => { if (run && run.hearts <= 0) finishStage(false); }, 1200);
  }

  /* ---------------- 判分 ---------------- */
  function markAnswer(q, correct) {
    run.answered = true;
    recordSkill(q.skill, correct);
    let gain = 0;
    if (correct) {
      run.correct += 1;
      run.combo += 1;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      gain = 8 + Math.min(run.combo, 6) * 2;
      run.xp += gain;
    } else {
      run.mistakes += 1;
      run.combo = 0;
      run.hearts -= 1;
    }
    run.answers.push({ skill: q.skill, correct, gain });
    return gain;
  }

  /* ---------------- 口语 ---------------- */
  async function startListen() {
    if (listening) return;
    const q = run.questions[run.index];
    const useSelf = !recognizerAvailable || recogFailures >= 2;
    if (feedback) run.tries += 1; // 上次已有结果，这次算「再来一次」
    sfx.listen();

    if (useSelf) {
      feedback = {
        type: "self",
        message: recognizerAvailable
          ? "语音识别连续出错，已切换到自评模式：先跟读示范，再自己判断。"
          : "当前浏览器不支持语音识别，使用自评模式。想用真识别请用电脑版 Chrome / Edge 打开。",
      };
      renderQuestion();
      speak(q.speakText);
      return;
    }

    listening = true;
    feedback = null;
    renderQuestion();

    try {
      const { transcript } = await listenOnce({ lang: "ja-JP", timeoutMs: 9000 });
      listening = false;
      if (!transcript) {
        recogFailures += 1;
        feedback = { score: 0, stars: 0, transcript: "", message: "没有听到声音，靠近麦克风再试。" };
        sfx.wrong();
        renderQuestion();
        return;
      }
      const result = scoreAttempt({ ja: q.target.ja, kana: q.target.kana }, transcript);
      recogFailures = 0;
      feedback = { ...result, transcript, source: "voice" };
      // 通过时也先把「几分 / 几星 / 我听到什么」显示出来，点「下一题」再计分前进
      if (result.passed) sfx.correct(run.combo);
      else sfx.wrong();
      renderQuestion();
    } catch (err) {
      listening = false;
      recogFailures += 1;
      feedback = {
        score: 0,
        stars: 0,
        transcript: "",
        message:
          err.message === "not-allowed"
            ? "浏览器拒绝麦克风权限，请在地址栏左侧允许后重试。"
            : err.message === "timeout"
              ? "等待超时，点麦克风重来。"
              : err.message === "network"
                ? "语音识别需要联网。"
                : "识别出错：" + err.message,
      };
      renderQuestion();
    }
  }

  function gradeSpeak(q, stars, skipped) {
    const correct = stars >= 1;
    run.answered = true;
    recordSkill("speaking", correct);
    let gain = 0;
    if (correct) {
      run.correct += 1;
      run.combo += 1;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      gain = skipped ? 0 : 8 + Math.min(run.combo, 6) * 2;
      run.xp += gain;
      sfx.correct(run.combo);
      run.answers.push({ skill: "speaking", correct, gain });
      run.answered = true;
      nextQuestion(true);
      return;
    }
    run.mistakes += 1;
    run.combo = 0;
    run.hearts -= 1;
    run.answers.push({ skill: "speaking", correct: false, gain: 0 });
    if (run.hearts <= 0) return finishStage(false);
    renderQuestion();
  }

  function nextQuestion(force) {
    if (!force && !run.answered) return;
    feedback = null;
    run.tries = 0;
    run.answered = false;
    run.index += 1;
    if (run.index >= run.questions.length) return finishStage(true);
    renderQuestion();
  }

  /* ---------------- 结算 ---------------- */
  function finishStage(cleared) {
    stopListening();
    listening = false;
    if (!run) return renderMap();
    const total = run.questions.length;
    const accuracy = run.correct / total;
    const mistakes = run.mistakes;
    let stars = 0;
    if (cleared && run.hearts > 0) {
      stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
    }
    const bonus = stars ? 20 + stars * 15 : 0;
    const xpGain = run.xp + bonus;
    const xpResult = xpGain ? addXp(xpGain) : null;
    saveStageResult(run.stage.id, { stars, score: Math.round(accuracy * 100), xp: 0 });

    const unlocked = [];
    const tryUnlock = (id, cond) => {
      if (cond && awardAchievement(id)) unlocked.push(id);
    };
    tryUnlock("first-clear", stars > 0);
    tryUnlock("three-stars", stars === 3);
    tryUnlock("no-miss", mistakes === 0 && stars > 0);
    tryUnlock("combo-5", run.maxCombo >= 5);
    tryUnlock("combo-10", run.maxCombo >= 10);
    tryUnlock("survivor", stars > 0 && run.hearts === HEARTS);
    tryUnlock("boss-n5", stars > 0 && run.stage.id === "n5-mixed-1");
    tryUnlock("boss-n4", stars > 0 && run.stage.id === "n4-mixed-1");
    tryUnlock("level-5", levelInfo().level >= 5);
    tryUnlock("stars-30", totalStars() >= 30);
    tryUnlock("all-rounder", skillStats().every((s) => s.level >= 2));
    tryUnlock(
      "level-clear",
      chapterPlan("N5").every((s) => (stageResult(s.id)?.stars || 0) > 0)
    );

    if (stars) sfx.win();
    else sfx.lose();
    if (xpResult?.leveledUp) setTimeout(() => sfx.levelUp(), 700);

    // 本关各技能表现
    const bySkill = {};
    for (const a of run.answers) {
      bySkill[a.skill] = bySkill[a.skill] || { correct: 0, total: 0 };
      bySkill[a.skill].total += 1;
      if (a.correct) bySkill[a.skill].correct += 1;
    }

    const plan = chapterPlan(levelTab);
    const idx = plan.findIndex((s) => s.id === run.stage.id);
    const next = plan[idx + 1];

    root.innerHTML = `
      <div class="card quest-result">
        <div class="result-emoji">${stars === 3 ? "🏆" : stars ? "🎉" : "💪"}</div>
        <h1>${stars ? "闯关成功！" : "生命值用完了…"}</h1>
        <p class="meta" style="color:var(--muted)">${escapeHtml(run.stage.title)} · 答对 ${run.correct}/${total} 题${
          stars ? "" : " · 再来一次一定行"
        }</p>
        <div class="stars big">${[0, 1, 2].map((s) => (s < stars ? "★" : "☆")).join("")}</div>

        <div class="grid cols-4" style="margin:16px 0">
          <div class="stat"><div class="num">${Math.round(accuracy * 100)}%</div><div class="lbl">正确率</div></div>
          <div class="stat"><div class="num">${run.maxCombo}</div><div class="lbl">最大连击</div></div>
          <div class="stat"><div class="num">+${xpGain}</div><div class="lbl">获得经验</div></div>
          <div class="stat"><div class="num">Lv${levelInfo().level}</div><div class="lbl">当前等级</div></div>
        </div>

        <table class="data">
          <thead><tr><th>本关技能</th><th class="num">答对</th><th class="num">题量</th></tr></thead>
          <tbody>
            ${Object.entries(bySkill)
              .map(
                ([k, v]) =>
                  `<tr><td>${skillEmoji(k)} ${skillLabel(k)}</td><td class="num">${v.correct}</td><td class="num">${v.total}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>

        ${
          unlocked.length
            ? `<div class="chips" style="justify-content:center;margin-top:12px">
                 ${unlocked
                   .map((id) => {
                     const a = ACHIEVEMENTS.find((x) => x.id === id);
                     return a ? `<span class="badge big-badge">${a.emoji} 新徽章：${escapeHtml(a.label)}</span>` : "";
                   })
                   .join("")}
               </div>`
            : ""
        }
        ${xpResult?.leveledUp ? `<p style="color:var(--gold);margin-top:10px"><b>🎖️ 升级了！现在是 Lv${xpResult.level}</b></p>` : ""}

        <div class="row" style="justify-content:center;margin-top:16px">
          <button class="btn primary" id="retry">${stars ? "再刷一次" : "重新挑战"}</button>
          ${next && stars ? `<button class="btn" id="next">下一关 →</button>` : ""}
          <button class="btn ghost" id="map">返回地图</button>
        </div>
      </div>
    `;

    root.querySelector("#retry").addEventListener("click", () => startStage(run.stage.id));
    root.querySelector("#map").addEventListener("click", renderMap);
    root.querySelector("#next")?.addEventListener("click", () => startStage(next.id));
  }

  /* ---------------- 键盘支持（选择题 1~4） ---------------- */
  function onKey(e) {
    if (!run || run.answered) return;
    const q = run.questions[run.index];
    if (q.type === "speak") {
      if (e.code === "Space") {
        e.preventDefault();
        startListen();
      }
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= (q.options?.length || 0)) {
      root.querySelector(`[data-opt="${n - 1}"]`)?.click();
    }
  }
  document.addEventListener("keydown", onKey);

  root.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-level]");
    if (lv && !lv.disabled) {
      levelTab = lv.dataset.level;
      setSetting("questLevel", levelTab);
      renderMap();
      return;
    }
    const st = e.target.closest("[data-stage]");
    if (st && !st.disabled) startStage(st.dataset.stage);
  });

  renderMap();

  return () => {
    document.removeEventListener("keydown", onKey);
    stopListening();
  };
}

function skillEmoji(skill) {
  return { vocab: "📗", grammar: "📐", kanji: "🈶", listening: "🎧", speaking: "🎤", mixed: "👑" }[skill] || "🎯";
}

function skillLabel(skill) {
  return (
    { vocab: "单词", grammar: "语法", kanji: "汉字", listening: "听力", speaking: "口语", mixed: "综合" }[skill] || "综合"
  );
}
