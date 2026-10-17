import { loadKanji, loadZh } from "../data.js";
import { isLearned, toggleLearned, getSettings, setSetting } from "../store.js";
import { escapeHtml, LEVELS } from "../util.js";
import { speak } from "../speech.js";
import { meaningsText, englishText } from "../gloss.js";

export default async function mount(root) {
  const settings = getSettings();
  let level = settings.kanjiLevel || "N5";
  let query = "";
  let items = [];
  let zh = {};
  let selected = null;
  let token = 0;

  async function load() {
    const myToken = ++token;
    root.innerHTML = `<h1>汉字</h1><div class="loading">正在加载 ${level} 汉字…</div>`;
    const [list, zhMap] = await Promise.all([loadKanji(level), loadZh(level)]);
    if (myToken !== token) return;
    items = list;
    zh = zhMap;
    selected = null;
    paint();
  }

  function filtered() {
    const q = query.trim();
    if (!q) return items;
    return items.filter(
      (k) =>
        k.character.includes(q) ||
        (k.meanings || []).some((m) => m.toLowerCase().includes(q.toLowerCase())) ||
        meaningsText(k.meanings, zh, 4).includes(q) ||
        (k.onyomi || []).some((r) => r.includes(q)) ||
        (k.kunyomi || []).some((r) => r.includes(q))
    );
  }

  function detailHtml(k) {
    const learned = isLearned(k.character);
    return `
      <div class="card" style="position:sticky;top:70px">
        <div class="row" style="align-items:flex-start">
          <div class="ja" style="font-size:4.2rem;line-height:1;font-weight:700">${escapeHtml(k.character)}</div>
          <div>
            <button class="icon-btn" data-speak="${escapeHtml(k.character)}" title="朗读">🔊</button>
            <div class="meta" style="color:var(--muted)">
              <span class="badge lv-${String(k.level).toLowerCase()}">${escapeHtml(k.level)}</span>
              笔画 ${k.strokes}
              ${k.grade ? `· 学年 ${k.grade}` : ""}
              ${k.freq ? `· 频率 ${k.freq}` : ""}
            </div>
          </div>
          <span class="spacer"></span>
          <button class="btn sm ${learned ? "active" : "ghost"}" data-known="${escapeHtml(k.character)}">${learned ? "✓ 已掌握" : "标记掌握"}</button>
        </div>

        <p class="meaning" style="margin-top:10px">${escapeHtml(meaningsText(k.meanings, zh, 4))}</p>
        ${
          englishText(k.meanings, zh, 4)
            ? `<p class="meta" style="color:var(--muted);font-size:.78rem;margin:2px 0 0">EN ${escapeHtml(
                englishText(k.meanings, zh, 4)
              )}</p>`
            : ""
        }

        <div class="readings" style="margin-top:8px">
          ${
            (k.onyomi || []).length
              ? `<div><b>音读</b>${k.onyomi.map((r) => `<span data-speak="${escapeHtml(r)}" class="tag" style="cursor:pointer">${escapeHtml(r)}</span>`).join("")}</div>`
              : ""
          }
          ${
            (k.kunyomi || []).length
              ? `<div><b>训读</b>${k.kunyomi.map((r) => `<span data-speak="${escapeHtml(r)}" class="tag" style="cursor:pointer">${escapeHtml(r)}</span>`).join("")}</div>`
              : ""
          }
          ${k.radical ? `<div><b>部首</b><span>${escapeHtml(k.radical)}${k.radical_number ? `（第 ${k.radical_number} 部）` : ""}</span></div>` : ""}
          ${(k.nanori || []).length ? `<div><b>名乘</b><span>${escapeHtml(k.nanori.join("、"))}</span></div>` : ""}
        </div>
      </div>`;
  }

  function paint() {
    const list = filtered();
    root.innerHTML = `
      <div class="row">
        <h1 style="margin:0">汉字</h1>
        <span class="spacer"></span>
        <span class="tag">${level} 共 ${items.length} 字</span>
      </div>

      <div class="card tight" style="position:sticky;top:57px;z-index:10;margin:12px 0">
        <div class="row">
          <div class="chips">
            ${LEVELS.map((lv) => `<button class="btn sm ${lv === level ? "active" : ""}" data-level="${lv}">${lv}</button>`).join("")}
          </div>
          <span class="spacer"></span>
          <input type="search" id="q" placeholder="搜索：汉字 / 读音 / 意思" value="${escapeHtml(query)}">
        </div>
      </div>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) ${selected ? "minmax(260px,340px)" : "0"};gap:16px" id="kanji-layout">
        <div class="card">
          ${
            list.length
              ? `<div class="kanji-grid">
                  ${list
                    .map(
                      (k) => `<button class="${isLearned(k.character) ? "learned" : ""} ${selected === k.character ? "selected" : ""}"
                        data-kanji="${escapeHtml(k.character)}" title="${escapeHtml(meaningsText(k.meanings, zh, 2))}">${escapeHtml(k.character)}</button>`
                    )
                    .join("")}
                </div>`
              : `<div class="empty">没有匹配的汉字</div>`
          }
        </div>
        ${selected ? detailHtml(items.find((k) => k.character === selected) || {}) : ""}
      </div>
      ${
        selected
          ? ""
          : `<p class="meta" style="color:var(--muted);margin-top:12px">点任意汉字查看音读、训读、部首和笔画数。</p>`
      }
    `;

    root.querySelector("#q")?.addEventListener("input", (e) => {
      query = e.target.value;
      const cursor = e.target.selectionStart;
      paint();
      const box = root.querySelector("#q");
      box.focus();
      box.setSelectionRange(cursor, cursor);
    });
  }

  root.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-level]");
    if (lv) {
      level = lv.dataset.level;
      setSetting("kanjiLevel", level);
      load();
      return;
    }
    const kj = e.target.closest("[data-kanji]");
    if (kj) {
      const ch = kj.dataset.kanji;
      selected = selected === ch ? null : ch;
      paint();
      return;
    }
    const known = e.target.closest("[data-known]");
    if (known) {
      toggleLearned(known.dataset.known);
      paint();
    }
  });

  await load();
}
