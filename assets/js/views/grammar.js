// 语法手册：N5–N1 全部句型，中文释义 + 中文讲解 + 日文例句
//
// 数据说明：
//   data/grammar/*.json        —— OpenJLPT 原始数据（英文释义、例句）
//   data/grammar-zh/*.json     —— 逐条人工撰写的中文释义 / 讲解（按 id 索引）
// 页面默认只显示中文；英文原文收进「英文原文对照」里，需要时再展开。
import { loadGrammar, loadGrammarZh } from "../data.js";
import { getSettings, setSetting, getState, toggleLearned } from "../store.js";
import { escapeHtml, LEVELS } from "../util.js";
import { exampleRuby, examplePlain } from "../furigana.js";
import { grammarText, grammarNote, grammarPattern, formationZh, tagZh, hasZh } from "../gloss.js";

const MAX_TAGS = 12;

export default async function mount(root) {
  const settings = getSettings();
  let level = settings.grammarLevel || "N5";
  let query = "";
  let activeTag = null;
  let onlyTodo = false;
  let tagsExpanded = false;
  let items = [];
  let gzh = {};
  let open = new Set();
  let token = 0;

  async function load() {
    const myToken = ++token;
    root.innerHTML = `<div class="loading">正在加载 ${level} 语法点…</div>`;
    const [list, zhMap] = await Promise.all([loadGrammar(level), loadGrammarZh(level)]);
    if (myToken !== token) return;
    items = list;
    gzh = zhMap;
    open = new Set();
    paint();
  }

  /* ---------------- 数据工具 ---------------- */

  const keyOf = (g) => `g:${g.level.toLowerCase()}:${g.id}`;
  const isMastered = (g) => !!getState().learned[keyOf(g)];
  const masteredCount = () => items.filter(isMastered).length;

  /** 上游 romaji 里夹着英文类别（"ga (subject)"），显示时去掉括号内容只留读音 */
  const romajiOf = (g) => String((g && g.romaji) || "").replace(/\s*\([^)]*\)/g, "").trim();

  function meaning(g) {
    return grammarText(g, {}, gzh);
  }

  function haystack(g) {
    return [
      g.pattern,
      grammarPattern(g, gzh),
      g.romaji,
      romajiOf(g),
      meaning(g),
      grammarNote(g, gzh),
      g.formation,
      formationZh(g.formation),
      g.meaning,
      ...(g.tags || []),
      ...(g.tags || []).map(tagZh),
      ...(g.examples || []).flatMap((ex) => [examplePlain(ex), ex.ja, ex.en]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function filtered() {
    const q = query.trim().toLowerCase();
    return items.filter((g) => {
      if (activeTag && !(g.tags || []).includes(activeTag)) return false;
      if (onlyTodo && isMastered(g)) return false;
      return !q || haystack(g).includes(q);
    });
  }

  function tagCounts() {
    const map = new Map();
    for (const g of items) for (const t of g.tags || []) map.set(t, (map.get(t) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  /* ---------------- 渲染工具 ---------------- */

  function hl(text, q) {
    const safe = escapeHtml(text ?? "");
    const needle = String(q || "").trim();
    if (!needle) return safe;
    const re = new RegExp(escapeHtml(needle).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    return safe.replace(re, (m) => `<mark>${m}</mark>`);
  }

  function exampleList(g, q) {
    const list = g.examples || [];
    if (!list.length) return `<p class="meta">暂无例句</p>`;
    return `<ul class="g-examples">${list
      .map(
        (ex) => `
        <li class="g-ex">
          <button class="icon-btn" data-speak="${escapeHtml(examplePlain(ex))}" title="朗读例句">🔊</button>
          <p class="ja">${exampleRuby(ex)}</p>
        </li>`
      )
      .join("")}</ul>`;
  }

  function englishBox(g) {
    const ens = (g.examples || []).filter((ex) => ex.en);
    if (!g.meaning && !ens.length && !g.formation) return "";
    return `
      <details class="g-en">
        <summary>英文原文对照</summary>
        ${g.meaning ? `<p class="en">${escapeHtml(g.meaning)}</p>` : ""}
        ${g.formation ? `<p class="en">接续：${escapeHtml(g.formation)}</p>` : ""}
        ${ens.length ? `<ul class="g-en-list">${ens.map((ex) => `<li>${escapeHtml(ex.en)}</li>`).join("")}</ul>` : ""}
      </details>`;
  }

  function itemHtml(g) {
    const q = query.trim();
    const isOpen = open.has(g.id);
    const done = isMastered(g);
    const note = grammarNote(g, gzh);
    const tags = (g.tags || []).map((t) => `<span class="tag">${escapeHtml(tagZh(t))}</span>`).join("");
    return `
      <article class="g-item${isOpen ? " open" : ""}${done ? " done" : ""}" data-gid="${escapeHtml(g.id)}">
        <div class="g-row">
          <button class="g-head" data-toggle="${escapeHtml(g.id)}" aria-expanded="${isOpen ? "true" : "false"}">
            <span class="g-pattern ja">${hl(grammarPattern(g, gzh), q)}</span>
            ${romajiOf(g) ? `<span class="g-romaji">${hl(romajiOf(g), q)}</span>` : ""}
            <span class="g-mean${hasZh(meaning(g)) ? "" : " en"}">${hl(meaning(g), q)}</span>
            <span class="g-caret" aria-hidden="true">▾</span>
          </button>
          <button class="g-star${done ? " on" : ""}" data-master="${escapeHtml(g.id)}"
                  title="${done ? "取消「已掌握」" : "标记为已掌握"}" aria-pressed="${done ? "true" : "false"}">${done ? "★" : "☆"}</button>
        </div>
        <div class="g-collapse"${isOpen ? "" : ' aria-hidden="true"'}>
          <div class="g-body">
            ${note ? `<div class="g-note"><b>💡 讲解</b><p>${hl(note, q)}</p></div>` : ""}
            ${
              g.formation
                ? `<div class="g-form"><span class="tag">接续</span><span class="ja">${escapeHtml(formationZh(g.formation))}</span></div>`
                : ""
            }
            ${exampleList(g, q)}
            <div class="g-foot">
              <div class="chips">${tags}</div>
              <span class="spacer"></span>
              <button class="btn sm" data-speak="${escapeHtml(
                grammarPattern(g, gzh)
                  .replace(/[（(].*?[）)]/g, "")
                  .replace(/[〜～/]/g, "")
              )}" title="朗读句型">🔊 读句型</button>
              <button class="btn sm${done ? " active" : ""}" data-master-btn="${escapeHtml(g.id)}">${done ? "★ 已掌握" : "标记已掌握"}</button>
              ${englishBox(g)}
            </div>
          </div>
        </div>
      </article>`;
  }

  /* ---------------- 主渲染 ---------------- */

  function paint() {
    const list = filtered();
    const mastered = masteredCount();
    const pct = items.length ? Math.round((mastered / items.length) * 100) : 0;
    const counts = tagCounts();
    const shownTags = tagsExpanded ? counts : counts.slice(0, MAX_TAGS);
    const hideTagsTip = counts.some(([t]) => t === activeTag) && !shownTags.some(([t]) => t === activeTag);
    const visibleTags = hideTagsTip ? [...shownTags, counts.find(([t]) => t === activeTag)] : shownTags;
    const hidden = counts.length - visibleTags.length;

    root.innerHTML = `
      <section class="g-hero">
        <div class="g-hero-main">
          <h1>语法 <span class="tag">中文释义</span></h1>
          <p class="g-sub">N5–N1 的每个句型都写好了中文释义和一句话讲解，例句带注音，可朗读。</p>
        </div>
        <div class="g-meter">
          <div class="g-meter-num">${mastered}<small>/${items.length}</small></div>
          <div class="g-meter-lbl">${level} 已掌握 ${pct}%</div>
          <div class="progress slim"><i style="width:${pct}%"></i></div>
        </div>
      </section>

      <div class="g-sticky">
        <div class="chips">
          ${LEVELS.map((lv) => `<button class="chip lv-chip${lv === level ? " active" : ""}" data-level="${lv}">${lv}</button>`).join("")}
        </div>
        <span class="spacer"></span>
        <input type="search" id="q" placeholder="搜索句型 / 读音 / 中文意思" value="${escapeHtml(query)}">
        <button class="btn sm" id="random-btn" title="随机抽一条来复习">🎲 随机抽查</button>
      </div>

      <div class="g-filters">
        <div class="chips">
          ${
            visibleTags.length
              ? visibleTags
                  .map(
                    ([t, n]) =>
                      `<button class="chip${t === activeTag ? " active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(
                        tagZh(t)
                      )}<small>${n}</small></button>`
                  )
                  .join("")
              : `<span class="meta">本等级暂无标签</span>`
          }
          ${
            hidden > 0
              ? `<button class="chip ghost" data-tags-more>+${hidden} 个标签</button>`
              : tagsExpanded && counts.length > MAX_TAGS
                ? `<button class="chip ghost" data-tags-less>收起标签</button>`
                : ""
          }
        </div>
        <div class="row g-actions">
          <span class="tag">显示 ${list.length} / ${items.length} 条</span>
          <button class="btn sm${onlyTodo ? " active" : ""}" data-only>${onlyTodo ? "✓ " : ""}只看未掌握</button>
          <button class="btn sm ghost" data-expand-all>全部展开</button>
          <button class="btn sm ghost" data-collapse-all>全部收起</button>
          ${activeTag || query ? `<button class="btn sm ghost" data-clear>清除筛选 ✕</button>` : ""}
        </div>
      </div>

      <div class="g-list">
        ${list.length ? list.map(itemHtml).join("") : `<div class="card empty">没有匹配的句型，换个关键词试试。</div>`}
      </div>
    `;

    const box = root.querySelector("#q");
    if (box && query) {
      box.focus();
      box.setSelectionRange(query.length, query.length);
    }
  }

  /* ---------------- 交互 ---------------- */

  function setOpen(id, yes) {
    if (yes) open.add(id);
    else open.delete(id);
    const item = root.querySelector(`.g-item[data-gid="${CSS.escape(id)}"]`);
    if (!item) return;
    item.classList.toggle("open", yes);
    const head = item.querySelector(".g-head");
    if (head) head.setAttribute("aria-expanded", yes ? "true" : "false");
    const body = item.querySelector(".g-collapse");
    if (body) {
      if (yes) body.removeAttribute("aria-hidden");
      else body.setAttribute("aria-hidden", "true");
    }
  }

  function refreshStar(id) {
    const item = root.querySelector(`.g-item[data-gid="${CSS.escape(id)}"]`);
    if (!item) return;
    const g = items.find((x) => x.id === id);
    if (!g) return;
    const done = isMastered(g);
    item.classList.toggle("done", done);
    const star = item.querySelector(".g-star");
    if (star) {
      star.classList.toggle("on", done);
      star.textContent = done ? "★" : "☆";
      star.setAttribute("aria-pressed", done ? "true" : "false");
      star.title = done ? "取消「已掌握」" : "标记为已掌握";
      star.animate?.([{ transform: "scale(1.4)" }, { transform: "scale(1)" }], { duration: 220, easing: "ease-out" });
    }
    const btn = item.querySelector("[data-master-btn]");
    if (btn) {
      btn.classList.toggle("active", done);
      btn.textContent = done ? "★ 已掌握" : "标记已掌握";
    }
    // 更新顶部进度
    const num = root.querySelector(".g-meter-num");
    const bar = root.querySelector(".g-meter .progress > i");
    const lbl = root.querySelector(".g-meter-lbl");
    const mastered = masteredCount();
    const pct = items.length ? Math.round((mastered / items.length) * 100) : 0;
    if (num) num.innerHTML = `${mastered}<small>/${items.length}</small>`;
    if (bar) bar.style.width = `${pct}%`;
    if (lbl) lbl.textContent = `${level} 已掌握 ${pct}%`;
  }

  function randomPick() {
    const list = filtered();
    const pick = list.length ? list[Math.floor(Math.random() * list.length)] : null;
    if (!pick) return;
    open = new Set([pick.id]);
    paint();
    const item = root.querySelector(`.g-item[data-gid="${CSS.escape(pick.id)}"]`);
    item?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  root.addEventListener("click", (e) => {
    const lv = e.target.closest("[data-level]");
    if (lv) {
      if (lv.dataset.level !== level) {
        level = lv.dataset.level;
        setSetting("grammarLevel", level);
        query = "";
        activeTag = null;
        onlyTodo = false;
        load();
      }
      return;
    }

    const star = e.target.closest("[data-master]");
    if (star) {
      const g = items.find((x) => x.id === star.dataset.master);
      if (g) {
        toggleLearned(keyOf(g));
        refreshStar(g.id);
      }
      return;
    }

    const masterBtn = e.target.closest("[data-master-btn]");
    if (masterBtn) {
      const g = items.find((x) => x.id === masterBtn.dataset.masterBtn);
      if (g) {
        toggleLearned(keyOf(g));
        refreshStar(g.id);
        if (onlyTodo) paint();
      }
      return;
    }

    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const id = toggle.dataset.toggle;
      setOpen(id, !open.has(id));
      return;
    }

    const tag = e.target.closest("[data-tag]");
    if (tag) {
      activeTag = activeTag === tag.dataset.tag ? null : tag.dataset.tag;
      paint();
      return;
    }

    if (e.target.closest("[data-tags-more]")) {
      tagsExpanded = true;
      paint();
      return;
    }
    if (e.target.closest("[data-tags-less]")) {
      tagsExpanded = false;
      paint();
      return;
    }
    if (e.target.closest("[data-only]")) {
      onlyTodo = !onlyTodo;
      paint();
      return;
    }
    if (e.target.closest("[data-expand-all]")) {
      open = new Set(filtered().map((g) => g.id));
      paint();
      return;
    }
    if (e.target.closest("[data-collapse-all]")) {
      open = new Set();
      paint();
      return;
    }
    if (e.target.closest("[data-clear]")) {
      activeTag = null;
      query = "";
      onlyTodo = false;
      paint();
      return;
    }
    if (e.target.closest("#random-btn")) {
      randomPick();
    }
  });

  root.addEventListener("input", (e) => {
    if (e.target.id !== "q") return;
    query = e.target.value;
    const at = e.target.selectionStart;
    paint();
    const box = root.querySelector("#q");
    if (box) {
      box.focus();
      box.setSelectionRange(at, at);
    }
  });

  // 按「/」快速跳到搜索框
  const onKey = (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
    const t = e.target;
    if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const box = root.querySelector("#q");
    if (box) {
      e.preventDefault();
      box.focus();
    }
  };
  document.addEventListener("keydown", onKey);

  await load();

  return () => document.removeEventListener("keydown", onKey);
}
