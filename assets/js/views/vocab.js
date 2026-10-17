import { loadVocab, loadPos, loadZh } from "../data.js";
import { isLearned, toggleLearned, addToDeck, isInDeck, getSettings, setSetting } from "../store.js";
import { escapeHtml, LEVELS } from "../util.js";
import { exampleLine } from "../furigana.js";
import { meaningsText, englishText } from "../gloss.js";

const PAGE = 40;

export default async function mount(root) {
  const settings = getSettings();
  let level = settings.level && LEVELS.includes(settings.level) ? settings.level : "N5";
  let query = "";
  let filter = "all"; // all | new | known | deck
  let shown = PAGE;
  let items = [];
  let posMap = {};
  let zh = {};
  let expanded = new Set();

  let token = 0;

  async function load() {
    const myToken = ++token;
    root.innerHTML = `<h1>JLPT 单词</h1><div class="loading">正在加载 ${level} 词表…</div>`;
    items = [];
    shown = PAGE;
    expanded = new Set();
    const [vocab, pos, zhMap] = await Promise.all([
      loadVocab(level),
      Object.keys(posMap).length ? Promise.resolve(posMap) : loadPos(),
      loadZh(level),
    ]);
    if (myToken !== token) return;
    items = vocab;
    posMap = pos;
    zh = zhMap;
    paint();
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return items.filter((v) => {
      if (filter === "new" && isLearned(v.id)) return false;
      if (filter === "known" && !isLearned(v.id)) return false;
      if (filter === "deck" && !isInDeck(v.id)) return false;
      if (!q) return true;
      return (
        v.word.includes(q) ||
        (v.reading || "").includes(q) ||
        (v.romaji || "").toLowerCase().includes(q) ||
        (v.meanings || []).some((m) => m.toLowerCase().includes(q)) ||
        meaningsText(v.meanings, zh, 4).toLowerCase().includes(q)
      );
    });
  }

  function paint() {
    const list = filtered();
    const slice = list.slice(0, shown);
    root.innerHTML = `
      <div class="row">
        <h1 style="margin:0">JLPT 单词</h1>
        <span class="spacer"></span>
        <span class="tag">本等级共 ${items.length} 词</span>
      </div>

      <div class="card tight" style="position:sticky;top:57px;z-index:10;margin:12px 0">
        <div class="row">
          <div class="chips">
            ${LEVELS.map((lv) => `<button class="btn sm ${lv === level ? "active" : ""}" data-level="${lv}">${lv}</button>`).join("")}
          </div>
          <span class="spacer"></span>
          <input type="search" id="q" placeholder="搜索：汉字 / 假名 / 罗马字 / 中文英文意思" value="${escapeHtml(query)}">
        </div>
        <div class="row" style="margin-top:8px">
          <div class="chips">
            ${[
              ["all", "全部"],
              ["new", "未标记"],
              ["known", "已掌握"],
              ["deck", "在复习队列"],
            ]
              .map(([id, label]) => `<button class="btn sm ${filter === id ? "active" : ""}" data-filter="${id}">${label}</button>`)
              .join("")}
          </div>
        </div>
      </div>

      ${
        slice.length
          ? `<ul class="list card">${slice.map(cardHtml).join("")}</ul>
             <div class="row" style="justify-content:center;margin-top:12px">
               ${
                 list.length > shown
                   ? `<button class="btn" id="more">再显示 ${Math.min(PAGE, list.length - shown)} 个（还有 ${list.length - shown} 个）</button>`
                   : `<span class="tag">已显示全部 ${list.length} 个</span>`
               }
             </div>`
          : `<div class="card empty">没有符合条件的单词</div>`
      }
    `;

    root.querySelector("#q")?.addEventListener("input", (e) => {
      query = e.target.value;
      shown = PAGE;
      const cursor = e.target.selectionStart;
      paint();
      const box = root.querySelector("#q");
      box.focus();
      box.setSelectionRange(cursor, cursor);
    });

    root.querySelector("#more")?.addEventListener("click", () => {
      shown += PAGE;
      paint();
    });
  }

  function cardHtml(v) {
    const known = isLearned(v.id);
    const inDeck = isInDeck(v.id);
    const open = expanded.has(v.id);
    const pos = (v.pos || []).map((p) => `<span class="tag" title="${escapeHtml(posMap[p] || "")}">${escapeHtml(p)}</span>`).join(" ");
    const ex = v.examples || [];
    return `
      <li>
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:8px">
            <span class="headword">${escapeHtml(v.word)}</span>
            ${v.reading && v.reading !== v.word ? `<span class="reading">${escapeHtml(v.reading)}</span>` : ""}
            ${v.romaji ? `<span class="meta">${escapeHtml(v.romaji)}</span>` : ""}
            <button class="icon-btn" data-speak="${escapeHtml(v.word)}" title="朗读">🔊</button>
          </div>
          <div class="meaning">${escapeHtml(meaningsText(v.meanings, zh, 3))}</div>
          ${
            englishText(v.meanings, zh, 3)
              ? `<div class="meta" style="color:var(--muted);font-size:.78rem">EN ${escapeHtml(englishText(v.meanings, zh, 3))}</div>`
              : ""
          }
          <div class="row" style="gap:6px;margin-top:6px">
            ${pos}
            ${
              ex.length
                ? `<button class="btn sm ghost" data-toggle="${v.id}">${open ? "收起例句" : `例句 (${ex.length})`}</button>`
                : ""
            }
            <button class="btn sm ${inDeck ? "ghost" : ""}" data-deck="${v.id}" ${inDeck ? "disabled" : ""}>
              ${inDeck ? "已在复习队列" : "加入复习"}
            </button>
            <button class="btn sm ${known ? "active" : "ghost"}" data-known="${v.id}">${known ? "✓ 已掌握" : "标记掌握"}</button>
          </div>
          ${open ? `<ul class="list" style="margin-top:8px">${ex.map(exampleLine).join("")}</ul>` : ""}
        </div>
      </li>`;
  }

  root.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-level]");
    if (lv) {
      level = lv.dataset.level;
      setSetting("level", level);
      load();
      return;
    }
    const f = e.target.closest("[data-filter]");
    if (f) {
      filter = f.dataset.filter;
      shown = PAGE;
      paint();
      return;
    }
    const t = e.target.closest("[data-toggle]");
    if (t) {
      const id = t.dataset.toggle;
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      paint();
      return;
    }
    const d = e.target.closest("[data-deck]");
    if (d) {
      addToDeck(d.dataset.deck, level);
      paint();
      return;
    }
    const k = e.target.closest("[data-known]");
    if (k) {
      toggleLearned(k.dataset.known);
      paint();
    }
  });

  await load();
}
