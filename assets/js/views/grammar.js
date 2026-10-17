import { loadGrammar, loadZh } from "../data.js";
import { getSettings, setSetting } from "../store.js";
import { escapeHtml, LEVELS } from "../util.js";
import { exampleLine, renderFurigana } from "../furigana.js";
import { grammarText, hasZh } from "../gloss.js";

export default async function mount(root) {
  const settings = getSettings();
  let level = settings.grammarLevel || "N5";
  let query = "";
  let items = [];
  let zh = {};
  let token = 0;

  async function load() {
    const myToken = ++token;
    root.innerHTML = `<h1>语法</h1><div class="loading">正在加载 ${level} 语法点…</div>`;
    const [list, zhMap] = await Promise.all([loadGrammar(level), loadZh(level)]);
    if (myToken !== token) return;
    items = list;
    zh = zhMap;
    paint();
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (g) =>
        g.pattern.includes(q) ||
        (g.romaji || "").toLowerCase().includes(q) ||
        (g.meaning || "").toLowerCase().includes(q) ||
        grammarText(g, zh).toLowerCase().includes(q)
    );
  }

  function paint() {
    const list = filtered();
    root.innerHTML = `
      <div class="row">
        <h1 style="margin:0">语法</h1>
        <span class="spacer"></span>
        <span class="tag">${level} 共 ${items.length} 条</span>
      </div>

      <div class="card tight" style="position:sticky;top:57px;z-index:10;margin:12px 0">
        <div class="row">
          <div class="chips">
            ${LEVELS.map((lv) => `<button class="btn sm ${lv === level ? "active" : ""}" data-level="${lv}">${lv}</button>`).join("")}
          </div>
          <span class="spacer"></span>
          <input type="search" id="q" placeholder="搜索句型 / 意思" value="${escapeHtml(query)}">
        </div>
      </div>

      ${
        list.length
          ? list
              .map(
                (g, i) => `
              <details class="card tight" ${i === 0 ? "open" : ""}>
                <summary style="cursor:pointer">
                  <b class="ja" style="font-size:1.1rem">${escapeHtml(g.pattern)}</b>
                  ${g.romaji ? `<span class="tag">${escapeHtml(g.romaji)}</span>` : ""}
                  <span class="meaning" style="margin-left:8px">${escapeHtml(grammarText(g, zh))}</span>
                </summary>
                <div style="margin-top:10px">
                  ${
                    hasZh(grammarText(g, zh)) && g.meaning
                      ? `<p class="meta" style="color:var(--muted);font-size:.78rem;margin:0 0 6px">EN ${escapeHtml(g.meaning)}</p>`
                      : ""
                  }
                  ${
                    g.formation
                      ? `<p class="meta" style="color:var(--muted);font-family:var(--font-ja)">接续：${renderFurigana(g.formation)}</p>`
                      : ""
                  }
                  ${
                    (g.examples || []).length
                      ? `<ul class="list">${g.examples.map(exampleLine).join("")}</ul>`
                      : `<p class="meta" style="color:var(--muted)">暂无例句</p>`
                  }
                </div>
              </details>`
              )
              .join("")
          : `<div class="card empty">没有匹配的句型</div>`
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
      setSetting("grammarLevel", level);
      load();
    }
  });

  await load();
}
