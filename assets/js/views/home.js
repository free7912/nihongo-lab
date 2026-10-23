import {
  cardStats,
  kanaStats,
  streak,
  recentDays,
  learnedCount,
  levelInfo,
  totalStars,
  skillStats,
  shadowStats,
  stageResult,
  overallScore,
} from "../store.js";
import { LEVELS, escapeHtml } from "../util.js";
import { chapterPlan, LEVEL_ORDER } from "../quest-engine.js";

const activity = (d) => d.reviews + d.quizzes + (d.quests || 0) + (d.shadow || 0);

export default async function mount(root) {
  const cards = cardStats();
  const kana = kanaStats();
  const days = recentDays(14);
  const max = Math.max(1, ...days.map(activity));
  const totals = days.reduce((s, d) => s + activity(d), 0);
  const info = levelInfo();
  const skills = skillStats();
  const score = overallScore();
  const shadow = shadowStats();
  const next = recommendNext();

  root.innerHTML = `
    <section class="g-hero">
      <div class="g-hero-main">
        <span class="sh-kicker">NIHONGO LAB</span>
        <h1>今天也一起学日语吧</h1>
        <p class="g-sub">主线是「闯关路线」：单词 → 汉字 → 语法 → 口语 → 综合试炼，从 N5 一路打到 N1。
        想练嘴上的功夫，就去<a href="#/shadow">影子跟读</a>。所有进度只保存在你自己的浏览器里。</p>
      </div>
      <div class="sh-hero-stats">
        <div class="sh-stat"><b>${streak()}</b><span>连续（天）</span></div>
        <div class="sh-stat"><b>Lv${info.level}</b><span>经验</span></div>
        <div class="sh-stat"><b>${totalStars()}</b><span>闯关星星</span></div>
        <div class="sh-stat"><b>${score}</b><span>综合分</span></div>
      </div>
    </section>

    <div class="grid cols-2" style="margin-top:14px">
      <div class="card">
        <div class="card-head">
          <h3>📌 该闯下一关了</h3>
          <span class="spacer"></span>
          <a class="btn sm ghost" href="#/quest">完整路线</a>
        </div>
        ${
          next
            ? `<div class="row">
                <div class="node-icon big">${next.stage.emoji}</div>
                <div style="flex:1;min-width:180px">
                  <b class="ja">${escapeHtml(next.stage.title)}</b>
                  <div class="meta" style="color:var(--muted)">${escapeHtml(next.stage.desc)} · ${next.stage.count} 题${
                    next.locked ? "（需要先通关前面的关卡）" : ""
                  }</div>
                </div>
                <a class="btn primary" href="#/quest">去闯关</a>
              </div>`
            : `<p style="margin:0">N5–N1 的路线都三星通关了，太强了！可以去
               <a href="#/cards">闪卡复习</a> 保持手感，或者到 <a href="#/quiz">假名测验</a> 刷正确率。</p>`
        }
      </div>

      <div class="card">
        <div class="card-head">
          <h3>🎙️ 影子跟读</h3>
          <span class="spacer"></span>
          <span class="tag">今日 ${shadow.today} 句</span>
        </div>
        <p class="meta" style="color:var(--muted);margin:0 0 10px">
          听一句、跟一句、录下来对比。累计 ${shadow.total} 句，其中 ${shadow.best3} 句自评「很像」。
        </p>
        <div class="row">
          <a class="btn accent" href="#/shadow">开始跟读</a>
          <a class="btn ghost sm" href="#/shadow">换素材</a>
        </div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><h3>全方位水平</h3><span class="spacer"></span><span class="tag">综合 ${score} 分</span></div>
        <div class="skl-list">
          ${skills
            .map(
              (s) => `<div class="skl">
                <div class="row" style="gap:6px">
                  <span>${s.emoji}</span><b>${s.label}</b>
                  <span class="spacer"></span>
                  <span class="tag">Lv${s.level}${s.nextAt ? ` · 还差 ${Math.max(0, s.nextAt - s.correct)} 题` : ""}</span>
                </div>
                <div class="progress slim"><i style="width:${s.pct}%"></i></div>
                <div class="meta">练过 ${s.seen} 题 · 正确率 ${(s.accuracy * 100).toFixed(0)}%</div>
              </div>`
            )
            .join("")}
        </div>
        <p class="meta" style="color:var(--muted);margin-top:12px">五项都练，才不会「会读不会说、会背不会听」。</p>
      </div>

      <div class="card">
        <div class="card-head"><h3>快速入口</h3></div>
        <div class="row">
          <a class="btn primary" href="#/quest">🎮 闯关路线</a>
          <a class="btn accent" href="#/shadow">🎙️ 跟读</a>
          <a class="btn" href="#/kana">五十音</a>
          <a class="btn" href="#/cards">闪卡复习</a>
          <a class="btn" href="#/vocab">词表</a>
          <a class="btn" href="#/kanji">汉字</a>
          <a class="btn" href="#/grammar">语法</a>
        </div>
        <div style="margin-top:18px">
          <div class="row" style="gap:6px">
            <b>打卡情况</b><span class="spacer"></span><span class="tag">14 天共 ${totals} 次练习</span>
          </div>
          ${activityBars(days, max, totals)}
        </div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:14px">
      <div class="card">
        <div class="card-head"><h3>闪卡掌握度</h3><span class="spacer"></span><span class="tag">已标记 ${learnedCount()} 个</span></div>
        <table class="data">
          <thead><tr><th>等级</th><th class="num">在学</th><th class="num">待复习</th><th class="num">已掌握</th></tr></thead>
          <tbody>
            ${LEVELS.map((lv) => {
              const s = cardStats(lv);
              return `<tr><td><span class="badge lv-${lv.toLowerCase()}">${lv}</span></td>
                <td class="num">${s.total}</td><td class="num">${s.due}</td><td class="num">${s.mature}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head"><h3>还不太熟的假名</h3><span class="spacer"></span><span class="tag">待复习卡片 ${cards.due}</span></div>
        ${
          kana.weak.length
            ? `<div class="chips">${kana.weak
                .map(
                  (w) =>
                    `<button class="btn sm" data-speak="${escapeHtml(w.kana)}" style="font-family:var(--font-ja)">${
                      escapeHtml(w.kana)
                    } <small style="color:var(--accent)">×${w.wrong}</small></button>`
                )
                .join("")}</div>
               <p class="meta" style="color:var(--muted);margin-top:10px">点击听发音，去 <a href="#/quiz">假名测验</a> 巩固。</p>`
            : `<div class="empty">还没有假名测验记录，先去 <a href="#/quiz">假名测验</a> 练练手。</div>`
        }
      </div>
    </div>
  `;
}

/** 推荐关卡：按等级顺序找第一个还没拿到星星的关卡 */
function recommendNext() {
  for (let i = 0; i < LEVEL_ORDER.length; i++) {
    const level = LEVEL_ORDER[i];
    if (i > 0) {
      const prevBoss = `${LEVEL_ORDER[i - 1].toLowerCase()}-mixed-1`;
      if (!(stageResult(prevBoss)?.stars > 0)) continue; // 该等级还没解锁，跳过
    }
    const plan = chapterPlan(level);
    for (let j = 0; j < plan.length; j++) {
      const res = stageResult(plan[j].id);
      if (!(res?.stars > 0)) return { stage: plan[j], locked: j > 0 && !(stageResult(plan[j - 1].id)?.stars > 0) };
    }
  }
  return null;
}

/** 14 天活动柱状图；一条记录都没有时给个占位，别只画一排扁线 */
function activityBars(days, max, totals) {
  if (!totals) {
    return `<div class="bars-empty" style="margin-top:10px">还没有练习记录<br>做一关、跟读一句、复习几张卡，这里就会亮起来</div>`;
  }
  return `<div class="bars" style="margin-top:10px">${days
    .map(
      (d, i) =>
        `<div class="bar" style="height:${Math.round((activity(d) / max) * 100)}%" title="${d.key}：复习 ${
          d.reviews
        } · 测验 ${d.quizzes} · 闯关 ${d.quests || 0} · 跟读 ${d.shadow || 0}"><span>${
          i % 2 === 0 ? d.label : ""
        }</span></div>`
    )
    .join("")}</div>`;
}
