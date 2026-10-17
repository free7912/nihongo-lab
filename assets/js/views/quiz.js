import { KANA_GROUPS, flattenGroup } from "../kana-data.js";
import { recordKana, getSettings, setSetting, addXp, levelInfo } from "../store.js";
import { escapeHtml, sample, shuffle } from "../util.js";
import { speak } from "../speech.js";
import { sfx } from "../sfx.js";

const GROUP_OPTIONS = [...KANA_GROUPS.map((g) => ({ id: g.id, label: g.label })), { id: "all", label: "全部" }];
const MODES = [
  { id: "k2r", label: "看假名 → 选罗马字" },
  { id: "r2k", label: "看罗马字 → 选假名" },
];

export default async function mount(root) {
  const settings = getSettings();
  let cfg = {
    group: settings.quizGroup || "seion",
    script: settings.kanaScript || "kana",
    mode: settings.quizMode || "k2r",
    size: settings.quizSize || 10,
  };

  let session = null; // { questions, index, correct, wrong: [] }

  function pool() {
    const groups = cfg.group === "all" ? KANA_GROUPS : KANA_GROUPS.filter((g) => g.id === cfg.group);
    const cells = groups.flatMap((g) => flattenGroup(g, cfg.script));
    // 去重（同一罗马字对应的假名保留）
    return cells;
  }

  function buildSession() {
    const cells = pool();
    if (cells.length < 4) return null;
    const picks = sample(cells, Math.min(cfg.size, cells.length));
    const questions = picks.map((cell) => {
      const distractors = sample(
        cells.filter((c) => c.romaji !== cell.romaji && c.kana !== cell.kana),
        3
      );
      const options = shuffle([cell, ...distractors]);
      return { cell, options, answered: null };
    });
    return { questions, index: 0, correct: 0, xp: 0, wrong: [] };
  }

  function renderResult() {
    const total = session.questions.length;
    const acc = Math.round((session.correct / total) * 100);
    const graded = acc >= 90 ? "很稳！可以进下一阶段了。" : acc >= 70 ? "不错，再练一轮会更熟。" : "别急，先把错的这几个记住。";
    root.innerHTML = `
      <h1>假名测验 · 结果</h1>
      <div class="card" style="text-align:center">
        <div class="stat"><div class="num">${session.correct} / ${total}</div><div class="lbl">正确率 ${acc}%</div></div>
        <p style="margin-top:12px">${graded}</p>
        <p class="tag">本轮获得经验 +${session.xp} · 当前 Lv${levelInfo().level}（${levelInfo().into}/${levelInfo().need} XP）</p>
        <div class="row" style="justify-content:center">
          <button class="btn primary" id="again">再来一轮</button>
          <a class="btn" href="#/kana">回顾五十音图</a>
          <a class="btn" href="#/quest">去闯关</a>
        </div>
      </div>
      ${
        session.wrong.length
          ? `<div class="card">
              <div class="card-head"><h3>这些没答对</h3></div>
              <div class="chips">
                ${session.wrong
                  .map((w) => `<button class="btn sm" data-speak="${escapeHtml(w.kana)}"><span class="ja">${escapeHtml(w.kana)}</span> <small>${w.romaji}</small></button>`)
                  .join("")}
              </div>
            </div>`
          : ""
      }
    `;
    root.querySelector("#again")?.addEventListener("click", () => {
      session = buildSession();
      renderQuestion();
    });
  }

  function renderQuestion() {
    if (!session || session.index >= session.questions.length) return renderResult();
    const q = session.questions[session.index];
    const isKanaPrompt = cfg.mode === "k2r";
    const promptText = isKanaPrompt ? q.cell.kana : q.cell.romaji;
    const done = session.questions.filter((x) => x.answered !== null).length;

    root.innerHTML = `
      <div class="row" style="margin-bottom:8px">
        <h1 style="margin:0">假名测验</h1>
        <span class="spacer"></span>
        <span class="tag">${done + 1} / ${session.questions.length}</span>
      </div>
      <div class="progress" style="margin-bottom:16px"><i style="width:${(done / session.questions.length) * 100}%"></i></div>

      <div class="card">
        <div class="quiz-q">
          <div class="prompt ${isKanaPrompt ? "ja" : ""}">${escapeHtml(promptText)}</div>
          ${isKanaPrompt ? `<button class="icon-btn" data-speak="${escapeHtml(q.cell.kana)}" style="margin-top:6px;font-size:1.4rem">🔊</button>` : ""}
        </div>
        <div class="quiz-options">
          ${q.options
            .map((opt, i) => {
              const text = isKanaPrompt ? opt.romaji : opt.kana;
              return `<button class="btn ${isKanaPrompt ? "" : "ja"}" data-idx="${i}">${escapeHtml(text)}</button>`;
            })
            .join("")}
        </div>
        <p class="meta" style="color:var(--muted);margin-top:14px" id="feedback"></p>
      </div>

      <div class="card tight">
        <div class="row">
          <span class="tag">正确 ${session.correct}</span>
          <span class="spacer"></span>
          <button class="btn sm ghost" id="end">结束本轮</button>
        </div>
      </div>
    `;

    const buttons = [...root.querySelectorAll("[data-idx]")];
    buttons.forEach((btn) =>
      btn.addEventListener("click", () => {
        if (q.answered !== null) return;
        const chosen = q.options[Number(btn.dataset.idx)];
        const ok = chosen.romaji === q.cell.romaji;
        q.answered = ok ? "correct" : "wrong";
        if (ok) {
          session.correct += 1;
          session.xp += 2;
          addXp(2);
          sfx.correct(session.correct);
        } else {
          session.wrong.push(q.cell);
          sfx.wrong();
        }
        recordKana(q.cell.kana, ok);

        buttons.forEach((b) => {
          const opt = q.options[Number(b.dataset.idx)];
          if (opt.romaji === q.cell.romaji) b.classList.add("correct");
        });
        if (!ok) btn.classList.add("wrong");
        root.querySelector("#feedback").textContent = ok
          ? "正确 ✔"
          : `正确答案：${q.cell.kana}（${q.cell.romaji}）`;
        if (ok) speak(q.cell.kana, { rate: 0.9 });

        setTimeout(() => {
          session.index += 1;
          renderQuestion();
        }, ok ? 450 : 1100);
      })
    );
  }

  function renderStart() {
    root.innerHTML = `
      <h1>假名测验</h1>
      <p style="color:var(--muted)">选好范围，一轮 ${cfg.size} 题。答错的假名会被记下来。</p>
      <div class="card">
        <div class="card-head"><h3>范围</h3></div>
        <div class="chips">${GROUP_OPTIONS.map((g) => `<button class="btn sm ${cfg.group === g.id ? "active" : ""}" data-cfg="group" data-val="${g.id}">${g.label}</button>`).join("")}</div>

        <div class="card-head" style="margin-top:14px"><h3>字形</h3></div>
        <div class="chips">
          <button class="btn sm ${cfg.script === "kana" ? "active" : ""}" data-cfg="script" data-val="kana">平假名</button>
          <button class="btn sm ${cfg.script === "kata" ? "active" : ""}" data-cfg="script" data-val="kata">片假名</button>
        </div>

        <div class="card-head" style="margin-top:14px"><h3>题型</h3></div>
        <div class="chips">${MODES.map((m) => `<button class="btn sm ${cfg.mode === m.id ? "active" : ""}" data-cfg="mode" data-val="${m.id}">${m.label}</button>`).join("")}</div>

        <div class="card-head" style="margin-top:14px"><h3>题数</h3></div>
        <div class="chips">${[10, 20, 50].map((n) => `<button class="btn sm ${cfg.size === n ? "active" : ""}" data-cfg="size" data-val="${n}">${n} 题</button>`).join("")}</div>

        <div class="row" style="margin-top:18px">
          <button class="btn primary" id="start">开始测验</button>
          <span class="tag">可选假名 ${pool().length} 个</span>
        </div>
      </div>
    `;

    root.querySelectorAll("[data-cfg]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const key = btn.dataset.cfg;
        const val = key === "size" ? Number(btn.dataset.val) : btn.dataset.val;
        cfg[key] = val;
        setSetting(`quiz${key[0].toUpperCase()}${key.slice(1)}`, val);
        renderStart();
      })
    );

    root.querySelector("#start").addEventListener("click", () => {
      session = buildSession();
      if (!session) {
        alert("可选假名太少，换个范围试试。");
        return;
      }
      renderQuestion();
    });
  }

  renderStart();
}
