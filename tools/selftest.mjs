// 零依赖自检脚本：校验数据、闯关题目生成、SRS 与语音打分逻辑
//
// 用法（三选一）：
//   node tools/selftest.mjs
//   装了 VS Code 但没有 Node 时（Windows）：
//     $env:ELECTRON_RUN_AS_NODE=1; & "C:\...\Code.exe" tools/selftest.mjs
//
// 脚本会为 node 环境补上最小化的 localStorage / document / window / fetch，
// 因此可以直接 import 前端的 ES Module。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------------- 环境垫片 ---------------- */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const noop = () => {};
function makeEl(tag = "div") {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop,
    removeEventListener: noop,
    append: noop,
    appendChild: noop,
    replaceChildren: noop,
    setAttribute: noop,
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    click: noop,
    focus: noop,
    setSelectionRange: noop,
    innerHTML: "",
    textContent: "",
    value: "",
  };
}
globalThis.window = { addEventListener: noop, removeEventListener: noop, scrollTo: noop };
globalThis.document = {
  getElementById: () => makeEl(),
  createElement: (t) => makeEl(t),
  addEventListener: noop,
  removeEventListener: noop,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: makeEl("body"),
};
globalThis.location = { hash: "", replace: noop };
globalThis.window.location = globalThis.location;

globalThis.fetch = async (url) => {
  const file = path.resolve(ROOT, String(url).replace(/^\.\//, ""));
  if (!fs.existsSync(file)) return { ok: false, status: 404, json: async () => ({}) };
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
};

/* ---------------- 测试框架 ---------------- */
let pass = 0;
const failures = [];
function check(name, cond, detail = "") {
  if (cond) {
    pass += 1;
  } else {
    failures.push(`${name}${detail ? " :: " + detail : ""}`);
  }
}
function section(title) {
  console.log(`\n=== ${title} ===`);
}

/* ---------------- 1. 五十音数据 ---------------- */
section("五十音数据");
const kanaData = await import("../assets/js/kana-data.js");
for (const group of kanaData.KANA_GROUPS) {
  const width = kanaData.maxWidth(group, "kana");
  const widthKata = kanaData.maxWidth(group, "kata");
  check(`${group.label} 行列宽一致`, width === widthKata, `${width} vs ${widthKata}`);
  for (const row of group.rows) {
    check(
      `${group.label} ${row.kana} 与罗马字数量一致`,
      kanaData.cellsOf(row.kana).length === row.romaji.length,
      `${kanaData.cellsOf(row.kana).length} vs ${row.romaji.length}`
    );
  }
  console.log(`  ${group.label}: ${kanaData.flattenGroup(group, "kana").length} 音，列数 ${width}`);
}
check("清音 46 音", kanaData.flattenGroup(kanaData.KANA_GROUPS[0], "kana").length === 46);
check("浊音 25 音", kanaData.flattenGroup(kanaData.KANA_GROUPS[1], "kana").length === 25);
check("拗音 33 音", kanaData.flattenGroup(kanaData.KANA_GROUPS[2], "kana").length === 33);
check("平假名/片假名一一对应", (() => {
  const h = kanaData.allKana("kana");
  const k = kanaData.allKana("kata");
  return h.length === k.length && h.every((x, i) => x.romaji === k[i].romaji);
})());

/* ---------------- 2. 发音相似度打分 ---------------- */
section("语音打分");
const recog = await import("../assets/js/speech-recog.js");
const cases = [
  [{ ja: "私は学生です", kana: "わたしはがくせいです" }, "私は学生です", true],
  [{ ja: "私は学生です", kana: "わたしはがくせいです" }, "わたしはがくせいです", true],
  [{ ja: "ありがとうございます", kana: "ありがとうございます" }, "ありがとうございます", true],
  [{ ja: "ありがとうございます", kana: "ありがとうございます" }, "ありがとう", false],
  [{ ja: "みずをください", kana: "みずをください" }, "みずをください", true],
  [{ ja: "こんにちは", kana: "こんにちは" }, "まったくちがうことば", false],
];
for (const [target, said, shouldPass] of cases) {
  const r = recog.scoreAttempt(target, said);
  check(`打分「${said}」`, r.passed === shouldPass, `score=${r.score.toFixed(2)} stars=${r.stars}`);
}
check("片假名归一化", recog.normalizeJa("カード") === "かーど" || recog.normalizeJa("カード") === "かど", recog.normalizeJa("カード"));

/* ---------------- 3. 闯关路线与题目生成 ---------------- */
section("闯关路线");
const engine = await import("../assets/js/quest-engine.js");
const storeMod = await import("../assets/js/store.js");

const planN5 = engine.chapterPlan("N5");
check("N5 有 9 关", planN5.length === 9, String(planN5.length));
check("每关都有唯一 id", new Set(planN5.map((s) => s.id)).size === planN5.length);
check("存在综合试炼", planN5.some((s) => s.boss));
check("全部等级共 45 关", engine.allStages().length === 45, String(engine.allStages().length));

const typeStats = {};
for (const stage of engine.allStages().filter((s) => s.level === "N5" || s.level === "N4")) {
  const questions = await engine.buildStage(stage);
  check(`${stage.id} 题量正确`, questions.length === stage.count, `生成 ${questions.length} / 期望 ${stage.count}`);
  for (const q of questions) {
    typeStats[q.type] = (typeStats[q.type] || 0) + 1;
    check(`${stage.id} 题目有技能标签`, !!q.skill, q.id);
    if (q.type === "speak") {
      check(`${stage.id} 口语题有目标文本`, !!q.target?.kana || !!q.target?.ja, q.id);
      continue;
    }
    const opts = q.options || [];
    check(`${stage.id} 选择题 4 个选项`, opts.length === 4, `${q.id} -> ${opts.length}`);
    check(`${stage.id} 只有一个正确项`, opts.filter((o) => o.correct).length === 1, q.id);
    const texts = opts.map((o) => o.text);
    check(`${stage.id} 选项无重复`, new Set(texts).size === texts.length, `${q.id} -> ${texts.join(" | ")}`);
    check(`${stage.id} 选项非空`, texts.every((t) => t && t.length), `${q.id} -> ${texts.join(" | ")}`);
    if (q.type === "listen") check(`${stage.id} 听力题有音频文本`, !!q.speakText, q.id);
  }
}
console.log("  题型统计:", typeStats);

// 展示几道样题
section("样题预览");
for (const stage of [planN5[0], planN5[2], planN5[4], planN5[8]]) {
  const qs = await engine.buildStage(stage);
  const q = qs[0];
  const prompt = (q.promptHtml || "").replace(/<[^>]+>/g, " ").trim() || "(听力题)",
    opts = (q.options || []).map((o) => `${o.text}${o.correct ? "✔" : ""}`).join(" / ");
  console.log(`  [${stage.title}] type=${q.type} skill=${q.skill}`);
  console.log(`    题目: ${prompt.slice(0, 60)}`);
  if (opts) console.log(`    选项: ${opts.slice(0, 90)}`);
  if (q.type === "speak") console.log(`    跟读: ${q.target.ja}（${q.target.kana}）`);
}

/* ---------------- 4. 进度 / 技能 / 等级 ---------------- */
section("进度与技能系统");
const before = storeMod.levelInfo();
storeMod.addXp(500);
check("加经验生效", storeMod.levelInfo().xp === 500, String(storeMod.levelInfo().xp));
check("等级随经验提升", storeMod.levelInfo().level === 1 + Math.floor(500 / 200), String(storeMod.levelInfo().level));
storeMod.saveStageResult("n5-vocab-1", { stars: 3, score: 100, xp: 0 });
check("保存关卡结果", storeMod.stageResult("n5-vocab-1")?.stars === 3);
storeMod.saveStageResult("n5-vocab-1", { stars: 1, score: 60, xp: 0 });
check("星星只保留最好成绩", storeMod.stageResult("n5-vocab-1")?.stars === 3);
check("最高分保留", storeMod.stageResult("n5-vocab-1")?.best === 100);
storeMod.saveStageResult("n5-mixed-1", { stars: 2, score: 80, xp: 0 });
check("总星数统计", storeMod.totalStars() === 5, String(storeMod.totalStars()));
for (let i = 0; i < 30; i++) storeMod.recordSkill("vocab", i % 6 !== 0);
const skill = storeMod.skillStats().find((s) => s.id === "vocab");
check("技能统计题量", skill.seen === 30, String(skill.seen));
check("技能正确数", skill.correct === 25, String(skill.correct));
check("技能等级判定", skill.level === 2, `level=${skill.level} correct=${skill.correct}`);
check("综合水平分在 0~100", storeMod.overallScore() >= 0 && storeMod.overallScore() <= 100, String(storeMod.overallScore()));
check("成就解锁一次", storeMod.awardAchievement("first-clear") === true && storeMod.awardAchievement("first-clear") === false);
console.log(`  经验 ${storeMod.levelInfo().xp} / Lv${storeMod.levelInfo().level} · 综合 ${storeMod.overallScore()} 分`);

/* ---------------- 5. 数据文件完整性 ---------------- */
section("数据文件");
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "data/meta/meta.json"), "utf8"));
for (const lv of ["n5", "n4", "n3", "n2", "n1"]) {
  const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, `data/vocab/${lv}.json`), "utf8"));
  const kanji = JSON.parse(fs.readFileSync(path.join(ROOT, `data/kanji/${lv}.json`), "utf8"));
  const grammar = JSON.parse(fs.readFileSync(path.join(ROOT, `data/grammar/${lv}.json`), "utf8"));
  check(`${lv} 词表数量与 meta 一致`, vocab.length === meta.counts.vocab[lv.toUpperCase()], `${vocab.length}`);
  check(`${lv} 汉字数量与 meta 一致`, kanji.length === meta.counts.kanji[lv.toUpperCase()], `${kanji.length}`);
  check(`${lv} 语法数量与 meta 一致`, grammar.length === meta.counts.grammar[lv.toUpperCase()], `${grammar.length}`);
  console.log(
    `  ${lv.toUpperCase()}: 词 ${vocab.length} · 汉字 ${kanji.length} · 语法 ${grammar.length}`
  );
}

/* ---------------- 6. 中文释义层 ---------------- */
section("中文释义");
const glossMod = await import("../assets/js/gloss.js");
const zhN5 = await (await import("../assets/js/data.js")).loadZh("N5");
const zhKeys = Object.keys(zhN5);
check("loadZh 返回对象", zhKeys.length > 0, `N5 已翻译 ${zhKeys.length} 条（翻译脚本可能还在跑）`);
check("zhOf 无译文时回退英文", glossMod.zhOf("to meet", {}) === "to meet");
check("zhOf 命中时用中文", glossMod.zhOf("to meet", { "to meet": "见面" }) === "见面");
if (zhKeys.length) {
  const sampleQ = (await engine.buildStage(engine.chapterPlan("N5")[0]))[0];
  const texts = [sampleQ.promptHtml, ...(sampleQ.options || []).map((o) => o.text)].join(" ");
  check("闯关界面用上中文释义", /[\u4e00-\u9fff]/.test(texts), texts.slice(0, 60));
  console.log(`  N5 中文释义：${zhKeys.length} 条，例：${zhKeys[0]} -> ${zhN5[zhKeys[0]]}`);
}

/* ---------------- 7. 所有视图模块可加载 ---------------- */
section("模块加载");
const modules = [
  "../assets/js/app.js",
  "../assets/js/views/home.js",
  "../assets/js/views/quest.js",
  "../assets/js/views/kana.js",
  "../assets/js/views/quiz.js",
  "../assets/js/views/vocab.js",
  "../assets/js/views/kanji.js",
  "../assets/js/views/grammar.js",
  "../assets/js/views/cards.js",
  "../assets/js/views/stats.js",
  "../assets/js/sfx.js",
  "../assets/js/speech.js",
];
for (const m of modules) {
  try {
    const mod = await import(m);
    const needsDefault = m.includes("views/");
    check(`${m} 可加载`, !needsDefault || typeof mod.default === "function");
    console.log(`  ✓ ${m.replace("../assets/js/", "")}`);
  } catch (err) {
    check(`${m} 可加载`, false, err.message);
    console.log(`  ✗ ${m.replace("../assets/js/", "")} -> ${err.message}`);
  }
}

/* ---------------- 结果 ---------------- */
console.log(`\n================ 结果 ================`);
console.log(`通过 ${pass} 项，失败 ${failures.length} 项`);
if (failures.length) {
  console.log("\n失败明细：");
  failures.slice(0, 40).forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log("全部通过 ✅");
