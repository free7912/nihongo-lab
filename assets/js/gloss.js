// 中文释义层
//
// OpenJLPT 的释义是英文（"to meet" / "rice bowl"），本站面向中文学习者，
// 所以构建时用 tools/translate.py 生成 data/zh/*.json：
//   { "to meet": "见面；遇见", "rice bowl": "饭碗", ... }
// 这里负责把英文释义换成中文，取不到时自动回退英文原文。
//
// 语法是例外：它的 meaning 是一整句英文描述（"marks the topic of the sentence"），
// 词典/机器翻译对这类片段几乎无效（会出现「凭直觉行动」这种离谱结果），
// 所以 526 条语法释义全部人工写入 data/grammar-zh/*.json：
//   { "wa": { "m": "提示主题（读作 wa）…", "n": "放在主题词后面…" }, ... }
// 按 id 索引，即使上游改了英文措辞也不会失效。
import { stripFurigana } from "./furigana.js";
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

/** 语法点的人工中文条目（data/grammar-zh），取不到返回 null */
export function grammarZhEntry(g, gzh) {
  const hit = g && gzh && gzh[g.id];
  return hit && hit.m ? hit : null;
}

/** 语法点释义 → 中文（手写中文优先，其次词典译文，最后英文原文） */
export function grammarText(g, zh, gzh) {
  const entry = grammarZhEntry(g, gzh);
  if (entry) return entry.m;
  return zhOf(g.meaning || "", zh);
}

/** 语法点的一句话讲解（手写）；没有则返回空字符串 */
export function grammarNote(g, gzh) {
  const entry = grammarZhEntry(g, gzh);
  return (entry && entry.n) || "";
}

/**
 * 句型显示文本：上游有 44 个句型自带英文小括号标签（〜に（time）、〜で（means）），
 * data/grammar-zh 里给这些条目补了 p 字段（〜に（时间））。
 * 显示、选项、解析都必须走这个函数，保证三者文本一致。
 */
export function grammarPattern(g, gzh) {
  if (!g) return "";
  const entry = gzh && gzh[g.id];
  return (entry && entry.p) || g.pattern;
}

// 接续记法是英文占位词：Noun + は、Verb-te + いる、i-Adj stem …
// 逐个词换成中文。长词在前，避免 Verb-nai stem 被 Verb-nai 抢先替换。
const FORMATION_WORDS = [
  ["potential of the same verb", "同一动词的可能形"],
  ["potential form", "可能形"],
  ["ichidan verbs", "二类动词"],
  ["final u → e", "词尾 u→e"],
  ["final u → o", "词尾 u→o"],
  ["short form", "缩略形"],
  ["same verb", "同一动词"],
  ["Question word", "疑问词"],
  ["Group 1", "一类动词"],
  ["Group 2", "二类动词"],
  ["i-Adj stem", "い形容词词干"],
  ["Verb-nai stem", "动词（ない形）词干"],
  ["Verb-volitional", "动词（意志形）"],
  ["Verb-plain", "动词（普通形）"],
  ["Verb-dict", "动词（辞书形）"],
  ["Verb-stem", "动词（ます形词干）"],
  ["Verb-nai", "动词（ない形）"],
  ["Verb-te", "动词（て形）"],
  ["Verb-ta", "动词（た形）"],
  ["Verb-ba", "动词（ば形）"],
  ["i-Adj-ku", "い形容词（く形）"],
  ["i-Adj", "い形容词"],
  ["na-Adj", "な形容词"],
  ["Sentence", "句子"],
  ["Noun", "名词"],
  ["counter", "量词"],
  ["number", "数字"],
  ["receiver", "接受者"],
  ["giver", "给予者"],
  ["quantity", "数量"],
  ["particle", "助词"],
  ["stem", "词干"],
  ["plain", "普通形"],
];

/** 接续（formation）→ 中文记法 */
export function formationZh(text) {
  let s = stripFurigana(text);
  if (!s) return "";
  for (const [en, zh] of FORMATION_WORDS) {
    if (s.includes(en)) s = s.split(en).join(zh);
  }
  return s
    .replace(/\(/g, "（")
    .replace(/\)/g, "）")
    .replace(/\s*\+\s*/g, " ＋ ")
    .replace(/:\s+/g, "：")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 语法标签 → 中文（OpenJLPT 的 tags 是英文） */
const TAG_ZH = {
  written: "书面语",
  formal: "正式",
  emphasis: "强调",
  time: "时间",
  negation: "否定",
  condition: "条件",
  reason: "原因",
  degree: "程度",
  concession: "让步",
  criticism: "责备",
  emotion: "感情",
  manner: "方式",
  particle: "助词",
  sequence: "顺序",
  conjecture: "推测",
  relation: "关系",
  addition: "追加",
  result: "结果",
  casual: "口语",
  change: "变化",
  standpoint: "立场",
  contrast: "对比",
  limitation: "限定",
  possibility: "可能",
  comparison: "比较",
  conjugation: "活用",
  state: "状态",
  appearance: "样态",
  range: "范围",
  simultaneity: "同时",
  tendency: "倾向",
  topic: "主题",
  example: "举例",
  obligation: "义务",
  advice: "建议",
  quantity: "数量",
  politeness: "敬体",
  purpose: "目的",
  intention: "意志",
  question: "疑问",
  suggestion: "提议",
  necessity: "必要",
  ability: "能力",
  decision: "决定",
  quotation: "引用",
  surprise: "惊讶",
  means: "手段",
  request: "请求",
  prohibition: "禁止",
  completion: "完成",
  regret: "后悔",
  hearsay: "传闻",
  tense: "时态",
  invitation: "邀请",
  permission: "许可",
  "giving-receiving": "授受",
  voice: "语态",
  command: "命令",
  copula: "断定",
  desire: "希望",
  attempt: "尝试",
  demonstrative: "指示",
  honorific: "尊敬语",
  humble: "谦让语",
  nominalization: "名词化",
  wish: "祈愿",
  exclusion: "除外",
  recollection: "回忆",
  exclamation: "感叹",
  experience: "经验",
};

export function tagZh(tag) {
  const t = String(tag || "").trim();
  return TAG_ZH[t] || t;
}

/** 是否包含中文（用来决定要不要显示「英文」小字） */
export function hasZh(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ""));
}

/** 载入某一等级的中文释义表（失败返回空表，页面照常显示英文） */
export { loadZh };
