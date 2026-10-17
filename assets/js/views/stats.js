import {
  getState,
  cardStats,
  kanaStats,
  streak,
  recentDays,
  learnedCount,
  resetAll,
  levelInfo,
  totalStars,
  skillStats,
  overallScore,
  stageResult,
} from "../store.js";
import { escapeHtml, LEVELS } from "../util.js";
import { loadMeta } from "../data.js";
import { allStages, chapterPlan, LEVEL_ORDER } from "../quest-engine.js";

export default async function mount(root) {
  const st = getState();
  const kana = kanaStats();
  const days = recentDays(14);
  const max = Math.max(1, ...days.map((d) => d.reviews + d.quizzes + (d.quests || 0)));
  const totalReviews = days.reduce((s, d) => s + d.reviews, 0);
  const totalQuizzes = days.reduce((s, d) => s + d.quizzes, 0);
  const totalQuests = days.reduce((s, d) => s + (d.quests || 0), 0);
  const allCards = cardStats();
  const info = levelInfo();
  const skills = skillStats();
  const score = overallScore();
  const stages = allStages();
  const clearedStages = stages.filter((s) => stageResult(s.id)?.stars > 0).length;

  let meta = null;
  try {
    meta = await loadMeta();
  } catch {
    /* 数据缺失时不影响统计页 */
  }

  root.innerHTML = `
    <h1>学习统计</h1>
    <p style="color:var(--muted)">进度保存在本机浏览器（localStorage）。清理浏览器数据会一并清空。</p>

    <div class="grid cols-4" style="margin:16px 0">
      <div class="card stat"><div class="num">Lv${info.level}</div><div class="lbl">经验 ${info.xp}</div></div>
      <div class="card stat"><div class="num">${totalStars()}</div><div class="lbl">闯关星星（${clearedStages}/${stages.length} 关）</div></div>
      <div class="card stat"><div class="num">${score}</div><div class="lbl">综合水平分</div></div>
      <div class="card stat"><div class="num">${streak()}</div><div class="lbl">连续学习天数</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head"><h3>全方位水平</h3><span class="spacer"></span><a class="btn sm ghost" href="#/quest">去闯关</a></div>
      <div class="grid cols-2" style="gap:14px">
        ${skills
          .map(
            (s) => `<div class="skl">
              <div class="row" style="gap:6px">
                <span>${s.emoji}</span><b>${s.label}</b>
                <span class="spacer"></span>
                <span class="tag">Lv${s.level}${s.nextAt ? ` · 还差 ${Math.max(0, s.nextAt - s.correct)} 题` : " · 已满级"}</span>
              </div>
              <div class="progress slim"><i style="width:${s.pct}%"></i></div>
              <div class="meta">练过 ${s.seen} 题 · 正确率 ${(s.accuracy * 100).toFixed(0)}%</div>
            </div>`
          )
          .join("")}
      </div>
    </div>

    <div class="grid cols-2">
      <div class="card">
        <div class="card-head"><h3>最近 14 天</h3><span class="spacer"></span><span class="tag">复习 ${totalReviews} · 测验 ${totalQuizzes} · 闯关 ${totalQuests}</span></div>
        <div class="bars">
          ${days
            .map(
              (d, i) => `<div class="bar" style="height:${Math.round(
                ((d.reviews + d.quizzes + (d.quests || 0)) / max) * 100
              )}%"
                title="${d.key}：复习 ${d.reviews} · 测验 ${d.quizzes} · 闯关 ${d.quests || 0}"><span>${
                  i % 2 === 0 ? d.label : ""
                }</span></div>`
            )
            .join("")}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>假名练习</h3></div>
        <div class="grid cols-3">
          <div class="stat"><div class="num">${kana.touched}</div><div class="lbl">练过（共 104）</div></div>
          <div class="stat"><div class="num" style="color:var(--green)">${kana.correct}</div><div class="lbl">正确</div></div>
          <div class="stat"><div class="num" style="color:var(--accent)">${kana.wrong}</div><div class="lbl">错误</div></div>
        </div>
        <p class="meta" style="color:var(--muted);margin-top:10px">正确率 ${((kana.accuracy || 0) * 100).toFixed(0)}%</p>
        ${
          kana.weak.length
            ? `<div class="chips">${kana.weak
                .map((w) => `<button class="btn sm" data-speak="${escapeHtml(w.kana)}"><span class="ja">${escapeHtml(w.kana)}</span> <small style="color:var(--accent)">×${w.wrong}</small></button>`)
                .join("")}</div>`
            : ""
        }
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-head"><h3>闯关路线进度</h3></div>
      <table class="data">
        <thead>
          <tr><th>等级</th><th class="num">已通关</th><th class="num">星星</th><th>试炼</th><th>进度</th></tr>
        </thead>
        <tbody>
          ${LEVEL_ORDER.map((level) => {
            const plan = chapterPlan(level);
            const stars = plan.reduce((s, x) => s + (stageResult(x.id)?.stars || 0), 0);
            const done = plan.filter((x) => stageResult(x.id)?.stars > 0).length;
            const boss = stageResult(`${level.toLowerCase()}-mixed-1`);
            return `<tr>
              <td><span class="badge lv-${level.toLowerCase()}">${level}</span></td>
              <td class="num">${done} / ${plan.length}</td>
              <td class="num">${stars} / ${plan.length * 3}</td>
              <td>${boss?.stars ? "👑 " + "★".repeat(boss.stars) : "—"}</td>
              <td style="min-width:120px"><div class="progress"><i style="width:${(done / plan.length) * 100}%"></i></div></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="meta" style="color:var(--muted);margin-top:8px">下一等级会在通关上一等级的「综合试炼」后解锁。</p>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-head"><h3>分级进度</h3></div>
      <table class="data">
        <thead>
          <tr><th>等级</th><th class="num">卡片</th><th class="num">已掌握</th><th class="num">待复习</th><th class="num">已标记单词</th><th>掌握度</th></tr>
        </thead>
        <tbody>
          ${LEVELS.map((lv) => {
            const s = cardStats(lv);
            const total = itemsPerLevel(meta, lv, "vocab");
            const pctTotal = total ? Math.min(100, Math.round((s.mature / total) * 100)) : 0;
            const pct = total ? (s.mature / total) * 100 : 0;
            return `<tr>
              <td><span class="badge lv-${lv.toLowerCase()}">${lv}</span></td>
              <td class="num">${s.total}</td>
              <td class="num">${s.mature}</td>
              <td class="num">${s.due}</td>
              <td class="num">${learnedCount(lv)}</td>
              <td style="min-width:120px">
                <div class="progress"><i style="width:${pct}%"></i></div>
                <span class="meta" style="color:var(--muted)">${pctTotal}% of ${total || "?"} 词</span>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="card-head"><h3>数据</h3></div>
      <p class="meta" style="color:var(--muted)">题库来自 OpenJLPT（JMdict / KANJIDIC2 / Tatoeba，CC BY-SA 4.0）${
        meta ? `，版本 ${escapeHtml(meta.version)}` : ""
      }；中文释义由 tools/translate.py 在构建时生成。</p>
      <div class="row">
        <button class="btn" id="export">导出进度 JSON</button>
        <button class="btn accent" id="reset">清空全部进度</button>
      </div>
    </div>
  `;

  root.querySelector("#export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(st, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nihongo-lab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  root.querySelector("#reset").addEventListener("click", () => {
    if (!confirm("确定清空全部学习进度吗？此操作无法撤销。")) return;
    resetAll();
    mount(root);
  });
}

function itemsPerLevel(meta, level, kind) {
  const counts = meta?.counts?.[kind];
  if (!counts) return 0;
  return counts[level] || 0;
}
