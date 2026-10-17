// 中文释义层
//
// OpenJLPT 的释义是英文（"to meet" / "rice bowl"），本站面向中文学习者，
// 所以构建时用 tools/translate.py 生成 data/zh/*.json：
//   { "to meet": "见面；遇见", "rice bowl": "饭碗", ... }
// 这里负责把英文释义换成中文，取不到时自动回退英文原文。
import { loadZh } from "./data.js";

/** 单条英文释义 → 中文（没有译文时返回原文） */
export function zhOf(en, zh) {
  if (!en) return "";
  const hit = zh && zh[en];
  return hit || en;
}

/** 释义数组 → 显示文本（默认取前 2 条；不同英文义项译成同一个中文时自动去重） */
export function meaningsText(meanings, zh, n = 2) {
  const out = [];
  for (const m of (meanings || []).slice(0, Math.max(n, 2))) {
    const zhText = zhOf(m, zh);
    if (zhText && !out.includes(zhText)) out.push(zhText);
    if (out.length >= n) break;
  }
  return out.join("；");
}

/** 释义数组 → 英文原文（用于小字对照） */
export function englishText(meanings, zh, n = 2) {
  const list = (meanings || []).slice(0, n);
  const en = list.join("；");
  const cn = list.map((m) => zhOf(m, zh)).join("；");
  return en === cn ? "" : en;
}

/** 语法点释义 → 中文 */
export function grammarText(g, zh) {
  return zhOf(g.meaning || "", zh);
}

/** 是否包含中文（用来决定要不要显示「英文」小字） */
export function hasZh(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

/** 载入某一等级的中文释义表（失败返回空表，页面照常显示英文） */
export { loadZh };
