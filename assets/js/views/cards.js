import { loadVocab, loadZh } from "../data.js";
import { dueCards, getCard, reviewCard, deckIds, cardStats, getSettings, setSetting, addXp, levelInfo } from "../store.js";
import { escapeHtml, LEVELS, sample } from "../util.js";
import { exampleLine } from "../furigana.js";
import { speak } from "../speech.js";
import { meaningsText, englishText } from "../gloss.js";
import { sfx } from "../sfx.js";

const NEW_PER_SESSION = 15;
const MAX_SESSION = 60;

const GRADES = [
  { g: 0, label: "忘记", hint: "5 分钟后", cls: "accent", key: "1" },
  { g: 1, label: "困难", hint: "短间隔", cls: "", key: "2" },
  { g: 2, label: "记得", hint: "正常", cls: "primary", key: "3" },
  { g: 3, label: "简单", hint: "长间隔", cls: "", key: "4" },
];

export default async function mount(root) {
  const settings = getSettings();
  let level = settings.cardLevel || "N5";
  let queue = null; // { items: [], index, revealed, tally }
  let vocabIndex = new Map();
  let zhMaps = new Map();
  let cleanupKeys = () => {};

  async function ensureLevel(lv) {
    if (vocabIndex.has(lv)) return vocabIndex.get(lv);
    const [list, zh] = await Promise.all([loadVocab(lv), loadZh(lv)]);
    vocabIndex.set(lv, list);
    zhMaps.set(lv, zh);
    return list;
  }

  async function buildQueue() {
    root.innerHTML = `<h1>闪卡复习</h1><div class="loading">正在准备复习队列…</div>`;
    const list = await ensureLevel(level);
    const byId = new Map(list.map((v) => [v.id, v]));
    const due = dueCards(level)
      .sort((a, b) => a.due - b.due)
      .map((c) => byId.get(c.id))
      .filter(Boolean);
    const inDeck = new Set(deckIds());
    const fresh = sample(list.filter((v) => !inDeck.has(v.id)), Math.max(0, NEW_PER_SESSION - due.length * 0));
    const items = [...due, ...fresh].slice(0, MAX_SESSION);
    queue = { items, index: 0, revealed: false, tally: { 0: 0, 1: 0, 2: 0, 3: 0 } };
    paint();
  }

  function paint() {
    if (queue) installKeys();
    if (!queue || queue.index >= queue.items.length) return paintDone();
    const item = queue.items[queue.index];
    const card = getCard(item.id, level);
    const isNew = card.reps === 0 && card.seen === 0;
    const pct = (queue.index / queue.items.length) * 100;

    root.innerHTML = `
      <div class="row" style="margin-bottom:8px">
        <div class="chips">
          ${LEVELS.map((lv) => `<button class="btn sm ${lv === level ? "active" : ""}" data-level="${lv}">${lv}</button>`).join("")}
        </div>
        <span class="spacer"></span>
        <span class="tag">${queue.index + 1} / ${queue.items.length}</span>
      </div>
      <div class="progress" style="margin-bottom:16px"><i style="width:${pct}%"></i></div>

      <div class="flashcard">
        <div class="meta" style="color:var(--muted)">
          ${isNew ? "新卡" : `第 ${card.reps + 1} 次见面`} · ${escapeHtml(level)}
        </div>
        <div class="word">${escapeHtml(item.word)}</div>
        <button class="icon-btn" data-speak="${escapeHtml(item.word)}" style="font-size:1.4rem">🔊</button>
        ${
          queue.revealed
            ? `<div class="reveal-box">
                 ${item.reading && item.reading !== item.word ? `<p class="reading" style="margin:0">${escapeHtml(item.reading)}</p>` : ""}
                 ${item.romaji ? `<p class="romaji" style="margin:0">${escapeHtml(item.romaji)}</p>` : ""}
                 <p class="meaning" style="margin:6px 0">${escapeHtml(meaningsText(item.meanings, zhMaps.get(level) || {}, 3))}</p>
                 ${
                   englishText(item.meanings, zhMaps.get(level) || {}, 3)
                     ? `<p class="meta" style="color:var(--muted);font-size:.78rem;margin:0">EN ${escapeHtml(
                         englishText(item.meanings, zhMaps.get(level) || {}, 3)
                       )}</p>`
                     : ""
                 }
                 ${
                   (item.examples || []).length
                     ? `<ul class="list" style="margin-top:6px">${(item.examples || []).slice(0, 2).map(exampleLine).join("")}</ul>`
                     : ""
                 }
               </div>`
            : `<p class="hint">先回忆意思，再按空格显示答案</p>`
        }
      </div>

      ${
        queue.revealed
          ? `<div class="grade-row">
              ${GRADES.map((g) => `<button class="btn ${g.cls}" data-grade="${g.g}">
                  <span>${g.label}</span><small>${g.key} · ${g.hint}</small></button>`).join("")}
            </div>`
          : `<div class="row" style="margin-top:14px;justify-content:center">
              <button class="btn primary" id="reveal" style="min-width:180px">显示答案（空格）</button>
              <button class="btn ghost" id="skip">跳过</button>
            </div>`
      }
    `;

    root.querySelector("#reveal")?.addEventListener("click", reveal);
    root.querySelector("#skip")?.addEventListener("click", () => {
      queue.index += 1;
      queue.revealed = false;
      paint();
    });
    root.querySelectorAll("[data-grade]").forEach((btn) =>
      btn.addEventListener("click", () => grade(Number(btn.dataset.grade)))
    );
  }

  function reveal() {
    queue.revealed = true;
    paint();
    const item = queue.items[queue.index];
    if (item) speak(item.word);
  }

  function grade(g) {
    const item = queue.items[queue.index];
    reviewCard(item.id, level, g);
    queue.tally[g] += 1;
    // 闪卡也给经验，和闯关共用一套等级
    const gain = g === 0 ? 1 : g === 3 ? 3 : 2;
    const level0 = levelInfo().level;
    addXp(gain);
    if (g === 0) sfx.wrong();
    else sfx.correct(0);
    if (levelInfo().level > level0) setTimeout(() => sfx.levelUp(), 400);
    queue.xp = (queue.xp || 0) + gain;
    queue.index += 1;
    queue.revealed = false;
    paint();
  }

  function installKeys() {
    cleanupKeys();
    const onKey = (e) => {
      if (!queue || queue.index >= queue.items.length) return;
      if (e.target.matches("input, textarea")) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (!queue.revealed) reveal();
        return;
      }
      if (queue.revealed && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key) - 1);
    };
    document.addEventListener("keydown", onKey);
    cleanupKeys = () => document.removeEventListener("keydown", onKey);
  }

  function paintDone() {
    cleanupKeys();
    cleanupKeys = () => {};
    const reviewed = queue ? queue.index : 0;
    const tally = queue?.tally || { 0: 0, 1: 0, 2: 0, 3: 0 };
    const stats = cardStats(level);
    const remain = stats.due;

    root.innerHTML = `
      <h1>本轮复习完成</h1>
      <div class="card" style="text-align:center">
        <div class="grid cols-4">
          <div class="stat"><div class="num">${reviewed}</div><div class="lbl">复习卡片</div></div>
          <div class="stat"><div class="num" style="color:var(--accent)">${tally[0]}</div><div class="lbl">忘记</div></div>
          <div class="stat"><div class="num" style="color:var(--green)">${tally[2] + tally[3]}</div><div class="lbl">记得 / 简单</div></div>
          <div class="stat"><div class="num">${remain}</div><div class="lbl">仍然到期</div></div>
        </div>
        <p class="tag" style="margin-top:10px">本轮获得经验 +${queue?.xp || 0} · 当前 Lv${levelInfo().level}（${levelInfo().into}/${levelInfo().need} XP）</p>
        <div class="row" style="justify-content:center;margin-top:16px">
          <button class="btn primary" id="again">${remain > 0 ? "继续复习" : "再来一组新卡"}</button>
          <a class="btn" href="#/stats">查看统计</a>
          <a class="btn" href="#/vocab">去词表挑词</a>
        </div>
      </div>
      ${
        reviewed === 0
          ? `<div class="card"><p class="meta" style="color:var(--muted)">没有可复习的内容：${level} 的词都已经排好下次复习时间，换一个等级或稍后再来。新卡每次最多 ${NEW_PER_SESSION} 张。</p></div>`
          : ""
      }
    `;
    root.querySelector("#again").addEventListener("click", () => buildQueue());
  }

  root.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-level]");
    if (lv && lv.dataset.level !== level) {
      level = lv.dataset.level;
      setSetting("cardLevel", level);
      buildQueue();
    }
  });

  await buildQueue();

  return () => {
    cleanupKeys();
  };
}
