// 闯关引擎：把词库 / 汉字库 / 语法库自动编排成一条 N5 → N1 的闯关主线
//
// 每关都由数据自动生成题目（同一关每次进入题目相同、选项顺序会变），
// 口语关另用原创的跟读素材 + 语法例句。
import { loadVocab, loadKanji, loadGrammar, loadZh, loadGrammarZh } from "./data.js";
import { shuffle } from "./util.js";
import { exampleRuby, examplePlain } from "./furigana.js";
import { meaningsText, grammarText, grammarPattern, formationZh, exampleZh } from "./gloss.js";
import { STAGES as SPEAK_STAGES, buildGrammarStage } from "./quest-data.js";

export const LEVEL_ORDER = ["N5", "N4", "N3", "N2", "N1"];

/* ---------------- 随机工具（固定种子，保证同一关题目稳定） ---------------- */

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(list, seed) {
  const rng = rngFrom(seed);
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------------- 关卡编排 ---------------- */

/** 每个等级的通关路线（9 关：单词×3、汉字、语法×2、口语×2、综合试炼） */
export function chapterPlan(level) {
  return [
    { kind: "vocab", seq: 1, emoji: "📗", title: "单词 · 认词", desc: "看日语单词选出意思", count: 10, types: ["word-meaning"] },
    { kind: "vocab", seq: 2, emoji: "📘", title: "单词 · 想词", desc: "看意思选出单词与读音", count: 10, types: ["meaning-word", "reading"] },
    { kind: "vocab", seq: 3, emoji: "🎧", title: "单词 · 听音", desc: "只放读音，凭听力选词", count: 10, types: ["listen-word"], skill: "listening" },
    { kind: "kanji", seq: 1, emoji: "🈶", title: "汉字 · 音训", desc: "汉字的意思与读音", count: 8, types: ["kanji-meaning", "kanji-reading"] },
    { kind: "grammar", seq: 1, emoji: "📐", title: "语法 · 句型", desc: "句型与它的意思", count: 8, types: ["grammar-meaning", "grammar-pick"] },
    { kind: "grammar", seq: 2, emoji: "📝", title: "语法 · 例句", desc: "看例句判断用了哪个句型", count: 8, types: ["grammar-example"] },
    { kind: "speak", seq: 1, emoji: "🎤", title: "口语 · 跟读", desc: "跟读单词与短句", count: 8, types: ["speak"] },
    { kind: "speak", seq: 2, emoji: "🗣️", title: "口语 · 成句", desc: "说完整的句子", count: 8, types: ["speak"] },
    {
      kind: "mixed",
      seq: 1,
      emoji: "👑",
      title: "综合试炼",
      desc: "单词 + 汉字 + 语法 + 听力 + 口语 全方面挑战",
      count: 12,
      boss: true,
      types: ["word-meaning", "meaning-word", "listen-word", "kanji-reading", "grammar-example", "speak"],
    },
  ].map((s) => ({
    ...s,
    id: `${level.toLowerCase()}-${s.kind}-${s.seq}`,
    level,
    skill: s.skill || (s.kind === "mixed" ? "mixed" : s.kind),
    title: `${level} ${s.title}`,
  }));
}

export function allStages() {
  return LEVEL_ORDER.flatMap((lv) => chapterPlan(lv));
}

export function findStage(id) {
  return allStages().find((s) => s.id === id) || null;
}

/** 生成题目 */
export async function buildStage(stage) {
  if (stage.kind === "vocab") return buildVocabStage(stage);
  if (stage.kind === "kanji") return buildKanjiStage(stage);
  if (stage.kind === "grammar") return buildGrammarLevelStage(stage);
  if (stage.kind === "speak") return buildSpeakStage(stage);
  if (stage.kind === "mixed") return buildMixedStage(stage);
  return [];
}

/* ---------------- 选项工具 ---------------- */

function pickOptions(correctItem, pool, toText, seed, n = 4) {
  const opts = [{ text: toText(correctItem), correct: true }];
  const seen = new Set([opts[0].text]);
  for (const p of seededShuffle(pool, seed)) {
    if (opts.length >= n) break;
    const text = toText(p);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    opts.push({ text, correct: false });
  }
  return shuffle(opts);
}

function meaningOf(v, zh) {
  return meaningsText(v.meanings, zh, 2);
}

function kanjiMeaningOf(k, zh) {
  return meaningsText(k.meanings, zh, 2);
}

function pickReading(k) {
  const pool = [...(k.kunyomi || []), ...(k.onyomi || [])];
  return pool[0] || "";
}

/* ---------------- 各类型关卡 ---------------- */

async function buildVocabStage(stage) {
  const [list, zh] = await Promise.all([loadVocab(stage.level), loadZh(stage.level)]);
  const ordered = seededShuffle(list, hashSeed(stage.level + "|vocab"));
  const offset = (stage.seq - 1) * stage.count;
  const words = ordered.slice(offset, offset + stage.count);
  const questions = [];
  const perType = Math.ceil(stage.count / stage.types.length);

  words.forEach((w, idx) => {
    // 多种题型时按顺序分段分配（前一半一种、后一半另一种）
    const useType = stage.types.length === 1 ? stage.types[0] : stage.types[Math.min(stage.types.length - 1, Math.floor(idx / perType))];
    const seed = hashSeed(stage.id + "|" + idx);
    const meaning = meaningOf(w, zh) || w.romaji;
    if (useType === "word-meaning") {
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "vocab",
        promptHtml: `<span class="q-word">${w.word}</span>`,
        promptSubHtml: w.reading && w.reading !== w.word ? w.reading : w.romaji,
        speakText: w.word,
        options: pickOptions(w, list, (x) => meaningOf(x, zh), seed),
        explain: `${w.word}（${w.reading || ""}）= ${meaning}`,
      });
    } else if (useType === "meaning-word") {
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "vocab",
        promptHtml: `<span class="q-meaning">${meaning}</span>`,
        promptSubHtml: "选出对应的日语单词",
        options: pickOptions(w, list, (x) => x.word, seed),
        explain: `${w.word}（${w.reading || ""}）`,
      });
    } else if (useType === "reading") {
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "vocab",
        promptHtml: `<span class="q-word">${w.word}</span>`,
        promptSubHtml: "这个单词怎么读？",
        speakText: w.word,
        options: pickOptions(w, list, (x) => x.reading || x.word, seed),
        explain: `${w.word} → ${w.reading || ""}（${w.romaji || ""}）`,
      });
    } else if (useType === "listen-word") {
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "listen",
        skill: "listening",
        promptHtml: "",
        promptSubHtml: "听发音，选出正确的单词",
        speakText: w.word,
        speakOnShow: true,
        options: pickOptions(w, list, (x) => x.word, seed),
        explain: `${w.word}（${w.reading || ""}）= ${meaning}`,
      });
    }
  });

  return questions;
}

async function buildKanjiStage(stage) {
  const [list, zh] = await Promise.all([loadKanji(stage.level), loadZh(stage.level)]);
  const ordered = seededShuffle(list, hashSeed(stage.level + "|kanji"));
  const items = ordered.slice((stage.seq - 1) * stage.count, (stage.seq - 1) * stage.count + stage.count);
  return items.map((k, idx) => {
    const seed = hashSeed(stage.id + "|" + idx);
    const type = idx % 2 === 0 ? "kanji-meaning" : "kanji-reading";
    if (type === "kanji-meaning") {
      return {
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "kanji",
        promptHtml: `<span class="q-kanji">${k.character}</span>`,
        promptSubHtml: `笔画 ${k.strokes || "?"}${k.radical ? ` · 部首 ${k.radical}` : ""}`,
        speakText: k.character,
        options: pickOptions(k, list, (x) => kanjiMeaningOf(x, zh), seed),
        explain: `${k.character}：${kanjiMeaningOf(k, zh)}｜音读 ${(k.onyomi || []).join("、")}｜训读 ${(k.kunyomi || []).join("、")}`,
      };
    }
    return {
      id: `${stage.id}-${idx}`,
      type: "choice",
      skill: "kanji",
      promptHtml: `<span class="q-kanji">${k.character}</span>`,
      promptSubHtml: "选出它的一种读音",
      speakText: k.character,
      options: pickOptions(k, list, (x) => pickReading(x), seed),
      explain: `${k.character}：音读 ${(k.onyomi || []).join("、")}｜训读 ${(k.kunyomi || []).join("、")}`,
    };
  });
}

async function buildGrammarLevelStage(stage) {
  const [list, zh, gzh] = await Promise.all([loadGrammar(stage.level), loadZh(stage.level), loadGrammarZh(stage.level)]);
  const ordered = seededShuffle(list, hashSeed(stage.level + "|grammar"));
  const items = ordered.slice((stage.seq - 1) * stage.count, (stage.seq - 1) * stage.count + stage.count);
  const questions = [];
  items.forEach((g, idx) => {
    const seed = hashSeed(stage.id + "|" + idx);
    const type = stage.types.length === 1 ? stage.types[0] : stage.types[idx % stage.types.length];
    const meaning = grammarText(g, zh, gzh);
    if (type === "grammar-meaning") {
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "grammar",
        promptHtml: `<span class="q-pattern">${grammarPattern(g, gzh)}</span>`,
        promptSubHtml: g.formation ? `接续：${formationZh(g.formation)}` : "",
        speakText: g.pattern.replace(/[〜～]/g, ""),
        options: pickOptions(g, list, (x) => grammarText(x, zh, gzh), seed),
        explain: `${grammarPattern(g, gzh)}：${meaning}`,
      });
    } else if (type === "grammar-pick") {
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "grammar",
        promptHtml: `<span class="q-meaning">${meaning}</span>`,
        promptSubHtml: "选出对应的句型",
        options: pickOptions(g, list, (x) => grammarPattern(x, gzh), seed),
        explain: `${grammarPattern(g, gzh)}：${meaning}`,
      });
    } else {
      const ex = (g.examples || [])[0];
      if (!ex) return;
      const exZh = exampleZh(g, gzh, 0);
      questions.push({
        id: `${stage.id}-${idx}`,
        type: "choice",
        skill: "grammar",
        promptHtml: `<span class="q-sentence">${exampleRuby(ex)}</span>`,
        promptSubHtml: exZh ? `这句话用了哪个句型？（${exZh}）` : "这句话用了哪个句型？",
        speakText: examplePlain(ex),
        options: pickOptions(g, list, (x) => grammarPattern(x, gzh), seed),
        explain: `例句用的是「${grammarPattern(g, gzh)}」（${meaning}）${exZh ? `　${exZh}` : ""}`,
      });
    }
  });
  return questions;
}

async function speakPool(level) {
  const pool = [];
  for (const stage of SPEAK_STAGES.filter((s) => s.level === level)) {
    pool.push(...stage.items.map((it) => ({ ...it, tip: stage.title })));
  }
  try {
    const generated = await buildGrammarStage(level, 1);
    if (generated) pool.push(...generated.items);
  } catch (err) {
    console.warn("口语素材生成失败", err);
  }
  return pool;
}

async function buildSpeakStage(stage) {
  let pool = await speakPool(stage.level);
  if (pool.length < stage.count) {
    // 素材不够就借用相邻等级（N2/N1 的原创素材较少）
    const idx = LEVEL_ORDER.indexOf(stage.level);
    for (const other of [LEVEL_ORDER[idx - 1], LEVEL_ORDER[idx + 1]].filter(Boolean)) {
      const extra = await speakPool(other);
      pool = pool.concat(extra);
      if (pool.length >= stage.count) break;
    }
  }
  const ordered = seededShuffle(pool, hashSeed(stage.level + "|speak"));
  const items = ordered.slice((stage.seq - 1) * stage.count, (stage.seq - 1) * stage.count + stage.count);
  return items.map((it, idx) => ({
    id: `${stage.id}-${idx}`,
    type: "speak",
    skill: "speaking",
    promptHtml: `<span class="q-meaning">${it.zh || "跟读这句话"}</span>`,
    promptSubHtml: it.tip ? `出自：${it.tip}` : "",
    target: { ja: it.ja, kana: it.kana, romaji: it.romaji },
    speakText: it.kana || it.ja,
    explain: `${it.ja}${it.kana && it.kana !== it.ja ? `（${it.kana}）` : ""}`,
  }));
}

async function buildMixedStage(stage) {
  const [vocab, kanji, grammar, zh, gzh] = await Promise.all([
    loadVocab(stage.level),
    loadKanji(stage.level),
    loadGrammar(stage.level),
    loadZh(stage.level),
    loadGrammarZh(stage.level),
  ]);
  const vSeed = hashSeed(stage.id + "|v");
  const kSeed = hashSeed(stage.id + "|k");
  const gSeed = hashSeed(stage.id + "|g");

  const vWords = seededShuffle(vocab, vSeed).slice(0, 5);
  const kItems = seededShuffle(kanji, kSeed).slice(0, 2);
  const gItems = seededShuffle(grammar, gSeed).slice(0, 2);

  const questions = [];

  vWords.forEach((w, i) => {
    const seed = hashSeed(stage.id + "|w" + i);
    const meaning = meaningOf(w, zh);
    if (i < 3) {
      questions.push({
        id: `${stage.id}-w${i}`,
        type: "choice",
        skill: "vocab",
        promptHtml: i === 2 ? `<span class="q-meaning">${meaning}</span>` : `<span class="q-word">${w.word}</span>`,
        promptSubHtml:
          i === 2 ? "选出对应的日语单词" : w.reading && w.reading !== w.word ? w.reading : w.romaji,
        speakText: w.word,
        options: pickOptions(w, vocab, i === 2 ? (x) => x.word : (x) => meaningOf(x, zh), seed),
        explain: `${w.word}（${w.reading || ""}）= ${meaning}`,
      });
    } else {
      questions.push({
        id: `${stage.id}-w${i}`,
        type: "listen",
        skill: "listening",
        promptHtml: "",
        promptSubHtml: "听发音选单词",
        speakText: w.word,
        speakOnShow: true,
        options: pickOptions(w, vocab, (x) => x.word, seed),
        explain: `${w.word}（${w.reading || ""}）= ${meaning}`,
      });
    }
  });

  kItems.forEach((k, i) => {
    questions.push({
      id: `${stage.id}-k${i}`,
      type: "choice",
      skill: "kanji",
      promptHtml: `<span class="q-kanji">${k.character}</span>`,
      promptSubHtml: i === 0 ? "选出它的一种读音" : "选出它的意思",
      speakText: k.character,
      options: pickOptions(
        k,
        kanji,
        i === 0 ? (x) => pickReading(x) : (x) => kanjiMeaningOf(x, zh),
        hashSeed(stage.id + "|k" + i)
      ),
      explain: `${k.character}：${kanjiMeaningOf(k, zh)}｜音读 ${(k.onyomi || []).join("、")}｜训读 ${(k.kunyomi || []).join("、")}`,
    });
  });

  gItems.forEach((g, i) => {
    const ex = (g.examples || [])[0];
    const meaning = grammarText(g, zh, gzh);
    const exZh = exampleZh(g, gzh, 0);
    questions.push({
      id: `${stage.id}-g${i}`,
      type: "choice",
      skill: "grammar",
      promptHtml: ex
        ? `<span class="q-sentence">${exampleRuby(ex)}</span>`
        : `<span class="q-pattern">${grammarPattern(g, gzh)}</span>`,
      promptSubHtml: ex ? (exZh ? `这句话用了哪个句型？（${exZh}）` : "这句话用了哪个句型？") : "选出它的意思",
      speakText: ex ? examplePlain(ex) : g.pattern.replace(/[〜～]/g, ""),
      options: pickOptions(g, grammar, (x) => (ex ? grammarPattern(x, gzh) : grammarText(x, zh, gzh)), hashSeed(stage.id + "|g" + i)),
      explain: `${grammarPattern(g, gzh)}：${meaning}`,
    });
  });

  // 口语部分（3 题）
  const speaks = await buildSpeakStage({ ...stage, kind: "speak", count: 3, types: ["speak"], seq: 1 });
  questions.push(...speaks.slice(0, 3));

  return seededShuffleQuestions(questions, hashSeed(stage.id + "|mixed"));
}

function seededShuffleQuestions(list, seed) {
  // 保持口语题分散在中间
  const speaks = list.filter((q) => q.type === "speak");
  const others = seededShuffle(list.filter((q) => q.type !== "speak"), seed);
  if (!speaks.length) return others;
  const out = others.slice();
  speaks.forEach((q, i) => out.splice(Math.min(out.length, 3 + i * 5), 0, q));
  return out;
}
