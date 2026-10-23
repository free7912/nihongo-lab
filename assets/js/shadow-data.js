// 影子跟读素材（两路来源，全部离线可用）：
//   1) 常用句：本项目原创的日常寒暄 / 场景句（quest-data.js 里的 STAGES）
//   2) 语法例句：OpenJLPT 语法数据里的例句（带注音）+ 人工撰写的中文句义
//
// 每句都会算好「拍数（モーラ）」，用来估算录音时长与节奏提示。

import { loadGrammar, loadGrammarZh } from "./data.js";
import { STAGES, exampleReading } from "./quest-data.js";
import { grammarPattern, exampleZh } from "./gloss.js";
import { renderFurigana, stripFurigana } from "./furigana.js";
import { escapeHtml, shuffle } from "./util.js";
import { moraCount } from "./recorder.js";

const cache = new Map();

export const SHADOW_SOURCES = [
  { id: "all", label: "全部" },
  { id: "phrase", label: "常用句" },
  { id: "example", label: "语法例句" },
];

/** 取某一等级的全部跟读素材：{ phrase, example, all }（带缓存） */
export function shadowItems(level) {
  const key = String(level);
  if (!cache.has(key)) cache.set(key, build(key));
  return cache.get(key);
}

async function build(level) {
  const phrase = phraseItems(level);
  let example = [];
  try {
    const [list, zhTable] = await Promise.all([loadGrammar(level), loadGrammarZh(level)]);
    example = exampleItems(level, list, zhTable);
  } catch (err) {
    console.warn("语法例句加载失败（跟读会只用常用句）", err);
  }
  return { phrase, example, all: dedupe([...phrase, ...example]) };
}

function phraseItems(level) {
  const out = [];
  for (const stage of STAGES) {
    if (stage.level !== level) continue;
    stage.items.forEach((item, i) => {
      out.push({
        id: `p:${stage.id}:${i}`,
        level,
        source: "phrase",
        ja: item.ja,
        ruby: escapeHtml(item.ja),
        kana: item.kana,
        romaji: item.romaji || "",
        zh: item.zh,
        mora: moraCount(item.kana),
        note: stage.desc,
        emoji: stage.emoji,
      });
    });
  }
  return out;
}

function exampleItems(level, list, zhTable) {
  const out = [];
  for (const g of list) {
    const pat = grammarPattern(g, zhTable);
    (g.examples || []).forEach((ex, i) => {
      const kana = exampleReading(ex);
      if (!kana || kana.length < 5 || kana.length > 44) return;
      const zh = exampleZh(g, zhTable, i);
      if (!zh) return;
      out.push({
        id: `e:${g.id}:${i}`,
        level,
        source: "example",
        ja: stripFurigana(ex.furigana || ex.ja),
        ruby: renderFurigana(ex.furigana || ex.ja),
        kana,
        romaji: "",
        zh,
        mora: moraCount(kana),
        note: `语法：${pat}`,
        emoji: "📖",
      });
    });
  }
  return out;
}

/** 同一句可能既在常用句里、又在例句里（按日语原文去重） */
function dedupe(items) {
  const seen = new Set();
  return items.filter((it) => {
    const key = it.ja.replace(/[\s　]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 按来源挑一批（默认 10 句），顺序随机 */
export function pickSet(items, count = 10) {
  return shuffle(items || []).slice(0, Math.max(1, count));
}

export function poolOf(bundle, source = "all") {
  if (!bundle) return [];
  return bundle[source] || bundle.all || [];
}
