// 把 OpenJLPT 的注音标记 "{漢字|かんじ}" 渲染成 <ruby>
import { escapeHtml } from "./util.js";

export function renderFurigana(text) {
  if (!text) return "";
  return escapeHtml(text).replace(/\{([^{}|]+)\|([^{}]+)\}/g, (_m, base, reading) => {
    return `<ruby>${base}<rt>${reading}</rt></ruby>`;
  });
}

/** 去掉注音标记，只留汉字本身 */
export function stripFurigana(text) {
  return String(text || "").replace(/\{([^{}|]+)\|[^{}]+\}/g, "$1");
}

/** 例句注音文本：数据里 `ja` 是纯文本，`furigana` 才带 {漢字|かんじ} 标记 */
export function exampleRuby(ex) {
  return renderFurigana((ex && (ex.furigana || ex.ja)) || "");
}

/** 例句纯文本（用来朗读 / 搜索） */
export function examplePlain(ex) {
  return stripFurigana((ex && (ex.furigana || ex.ja)) || "");
}

/** 带朗读按钮的例句行 */
export function exampleLine(ex) {
  const plain = examplePlain(ex);
  return `
    <li class="example">
      <button class="icon-btn" data-speak="${escapeHtml(plain)}" title="朗读">🔊</button>
      <div>
        <p class="ja">${exampleRuby(ex)}</p>
        ${ex.en ? `<p class="en">${escapeHtml(ex.en)}</p>` : ""}
      </div>
    </li>`;
}
