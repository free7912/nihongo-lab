import { installSpeakHandler } from "./speech.js";

const ROUTES = [
  { path: "home", label: "首页", load: () => import("./views/home.js") },
  { path: "quest", label: "闯关", load: () => import("./views/quest.js") },
  { path: "shadow", label: "跟读", load: () => import("./views/shadow.js") },
  { path: "kana", label: "五十音", load: () => import("./views/kana.js") },
  { path: "quiz", label: "假名测验", load: () => import("./views/quiz.js") },
  { path: "vocab", label: "单词", load: () => import("./views/vocab.js") },
  { path: "kanji", label: "汉字", load: () => import("./views/kanji.js") },
  { path: "grammar", label: "语法", load: () => import("./views/grammar.js") },
  { path: "cards", label: "闪卡", load: () => import("./views/cards.js") },
  { path: "stats", label: "统计", load: () => import("./views/stats.js") },
];

const main = document.getElementById("main");
const nav = document.getElementById("nav");
let cleanup = null;
let currentToken = 0;

/* ---------------- 深浅色主题 ---------------- */
const THEME_KEY = "jnl:theme";

function systemDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "dark" || mode === "light") root.dataset.theme = mode;
  else delete root.dataset.theme;
  const dark = mode === "dark" || (!mode && systemDark());
  const btn = document.getElementById("theme");
  if (btn) {
    btn.textContent = dark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", dark ? "切换到浅色主题" : "切换到深色主题");
    btn.title = dark ? "切换到浅色主题" : "切换到深色主题";
  }
  const meta = document.getElementById("theme-color");
  if (meta) meta.setAttribute("content", dark ? "#14151a" : "#f7f5f1");
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* 隐私模式忽略 */
  }
  // 方便截图 / 分享：?theme=dark
  const forced = new URLSearchParams(location.search).get("theme");
  const mode = forced === "dark" || forced === "light" ? forced : saved;
  applyTheme(mode);
  document.getElementById("theme")?.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : systemDark();
    const next = dark ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* 忽略 */
    }
  });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (!document.documentElement.dataset.theme) applyTheme(null);
  });
}

/* ---------------- 路由 ---------------- */
function renderNav(active) {
  nav.innerHTML = ROUTES.map(
    (r) =>
      `<a href="#/${r.path}" class="${r.path === active ? "active" : ""}" ${
        r.path === active ? 'aria-current="page"' : ""
      }>${r.label}</a>`
  ).join("");
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path] = raw.split("?");
  return ROUTES.find((r) => r.path === path) || ROUTES[0];
}

async function route() {
  const route = parseHash();
  const token = ++currentToken;

  if (typeof cleanup === "function") {
    try {
      cleanup();
    } catch (err) {
      console.warn(err);
    }
  }
  cleanup = null;

  renderNav(route.path);
  document.title = `${route.label} · 日本語ラボ`;

  // 每次渲染都换一个全新的容器，避免事件监听在 #main 上越积越多
  const view = document.createElement("div");
  view.className = "view";
  view.innerHTML = `<div class="loading">加载中…</div>`;
  main.replaceChildren(view);
  window.scrollTo({ top: 0 });

  try {
    const mod = await route.load();
    if (token !== currentToken) return;
    const result = await mod.default(view);
    if (token !== currentToken) return;
    if (typeof result === "function") cleanup = result;
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card">
      <h2>页面加载失败</h2>
      <p style="color:var(--muted)">${String(err.message || err)}</p>
      <p style="color:var(--muted)">如果是用 file:// 直接打开页面，请改用本地服务器（例如 <code>python tools/serve.py</code>）后再访问。</p>
    </div>`;
  }
}

initTheme();
installSpeakHandler(document);
window.addEventListener("hashchange", route);
if (!location.hash) location.replace("#/home");
route();
