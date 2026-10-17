import { installSpeakHandler } from "./speech.js";

const ROUTES = [
  { path: "home", label: "首页", load: () => import("./views/home.js") },
  { path: "quest", label: "闯关", load: () => import("./views/quest.js") },
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

function renderNav(active) {
  nav.innerHTML = ROUTES.map(
    (r) => `<a href="#/${r.path}" class="${r.path === active ? "active" : ""}">${r.label}</a>`
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

installSpeakHandler(document);
window.addEventListener("hashchange", route);
if (!location.hash) location.replace("#/home");
route();
