// 本地进度存储（localStorage）+ 简易 SRS 算法
const KEY = "jnl:v1";

const DEFAULT = {
  cards: {},      // id -> { ease, interval, due, reps, lapses, seen, correct, level }
  learned: {},    // id -> true（已掌握的单词/汉字）
  kana: {},       // 假名 -> { correct, wrong }
  history: {},    // "YYYY-MM-DD" -> { reviews, correct, quizzes, quizCorrect, quests }
  settings: { showRomaji: true, speechRate: 0.85, level: "N5", muted: false },
  quest: {
    xp: 0,
    stages: {},        // stageId -> { stars, best, plays, cleared, last }
    achievements: {},  // id -> timestamp
  },
  skills: {
    vocab: { seen: 0, correct: 0 },
    grammar: { seen: 0, correct: 0 },
    kanji: { seen: 0, correct: 0 },
    listening: { seen: 0, correct: 0 },
    speaking: { seen: 0, correct: 0 },
  },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw);
    const quest = parsed.quest || {};
    return {
      ...structuredClone(DEFAULT),
      ...parsed,
      settings: { ...DEFAULT.settings, ...(parsed.settings || {}) },
      cards: parsed.cards || {},
      learned: parsed.learned || {},
      kana: parsed.kana || {},
      history: parsed.history || {},
      quest: {
        xp: quest.xp || 0,
        stages: quest.stages || {},
        achievements: quest.achievements || {},
      },
      skills: {
        vocab: { seen: 0, correct: 0, ...(parsed.skills?.vocab || {}) },
        grammar: { seen: 0, correct: 0, ...(parsed.skills?.grammar || {}) },
        kanji: { seen: 0, correct: 0, ...(parsed.skills?.kanji || {}) },
        listening: { seen: 0, correct: 0, ...(parsed.skills?.listening || {}) },
        speaking: { seen: 0, correct: 0, ...(parsed.skills?.speaking || {}) },
      },
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

let state = read();
const listeners = new Set();

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("进度保存失败（可能是隐私模式或空间不足）", err);
  }
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}

export function getSettings() {
  return state.settings;
}

export function setSetting(key, value) {
  state.settings[key] = value;
  commit();
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function bumpHistory(patch) {
  const day = today();
  const cur = state.history[day] || { reviews: 0, correct: 0, quizzes: 0, quizCorrect: 0 };
  state.history[day] = { ...cur, ...patch(cur) };
}

/* ---------------- 单词 / 汉字 ---------------- */

export function isLearned(id) {
  return !!state.learned[id];
}

export function toggleLearned(id) {
  if (state.learned[id]) delete state.learned[id];
  else state.learned[id] = true;
  commit();
  return !!state.learned[id];
}

export function learnedCount(level) {
  const ids = Object.keys(state.learned);
  if (!level) return ids.length;
  return ids.filter((id) => state.cards[id]?.level === level).length;
}

/* ---------------- SRS 闪卡 ---------------- */

const DAY = 24 * 60 * 60 * 1000;

/** 手动把词条加入复习队列（新卡，立即到期） */
export function addToDeck(id, level) {
  if (state.cards[id]) return false;
  state.cards[id] = { id, level, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, seen: 0, correct: 0 };
  commit();
  return true;
}

export function isInDeck(id) {
  return !!state.cards[id];
}

export function deckIds() {
  return Object.keys(state.cards);
}

export function getCard(id, level) {
  const existing = state.cards[id];
  if (existing) return existing;
  return { id, level, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0, seen: 0, correct: 0 };
}

/** 评分：0=忘记 1=困难 2=一般 3=简单 */
export function reviewCard(id, level, grade) {
  const card = getCard(id, level);
  const now = Date.now();
  card.seen += 1;
  if (grade > 0) card.correct += 1;

  if (grade === 0) {
    card.lapses += 1;
    card.ease = Math.max(1.3, card.ease - 0.2);
    card.interval = 0;
    card.due = now + 5 * 60 * 1000; // 5 分钟后再见
  } else {
    if (grade === 1) card.ease = Math.max(1.3, card.ease - 0.15);
    if (grade === 3) card.ease = Math.min(3.2, card.ease + 0.12);

    const factor = grade === 1 ? 1.2 : grade === 3 ? card.ease * 1.3 : card.ease;
    if (card.reps === 0) card.interval = grade === 3 ? 2 : 1;      // 首次：1~2 天
    else if (card.reps === 1) card.interval = grade === 1 ? 2 : 4;  // 第二次：2~4 天
    else card.interval = Math.max(1, card.interval * factor);
    card.interval = Math.min(card.interval, 365);
    card.reps += 1;
    card.due = now + card.interval * DAY;
  }

  state.cards[id] = card;
  bumpHistory((h) => ({ reviews: h.reviews + 1, correct: h.correct + (grade > 0 ? 1 : 0) }));
  commit();
  return card;
}

/** 到期需要复习的卡片（含从未学过的新卡） */
export function dueCards(level) {
  const now = Date.now();
  return Object.values(state.cards).filter(
    (c) => (!level || c.level === level) && c.due <= now
  );
}

export function cardStats(level) {
  const all = Object.values(state.cards).filter((c) => !level || c.level === level);
  const now = Date.now();
  return {
    total: all.length,
    due: all.filter((c) => c.due <= now).length,
    learning: all.filter((c) => c.reps < 3).length,
    mature: all.filter((c) => c.reps >= 3 && c.interval >= 21).length,
    accuracy: all.reduce((s, c) => s + c.correct, 0) / Math.max(1, all.reduce((s, c) => s + c.seen, 0)),
  };
}

/* ---------------- 假名测验 ---------------- */

export function recordKana(kana, correct) {
  const cur = state.kana[kana] || { correct: 0, wrong: 0 };
  if (correct) cur.correct += 1;
  else cur.wrong += 1;
  state.kana[kana] = cur;
  bumpHistory((h) => ({ quizzes: h.quizzes + 1, quizCorrect: h.quizCorrect + (correct ? 1 : 0) }));
  commit();
}

export function kanaStats() {
  const entries = Object.entries(state.kana);
  const correct = entries.reduce((s, [, v]) => s + v.correct, 0);
  const wrong = entries.reduce((s, [, v]) => s + v.wrong, 0);
  const weak = entries
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 12)
    .map(([k, v]) => ({ kana: k, ...v }));
  return { touched: entries.length, correct, wrong, weak, accuracy: correct / Math.max(1, correct + wrong) };
}

/* ---------------- 统计 ---------------- */

export function streak() {
  let count = 0;
  const d = new Date();
  for (;;) {
    const p = (n) => String(n).padStart(2, "0");
    const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const h = state.history[key];
    const active = h && (h.reviews > 0 || h.quizzes > 0 || h.quests > 0);
    if (active) {
      count += 1;
      d.setDate(d.getDate() - 1);
    } else if (count === 0 && key === today()) {
      d.setDate(d.getDate() - 1); // 今天还没学，允许从昨天开始算
    } else break;
  }
  return count;
}

export function recentDays(n = 14) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(d.getTime() - i * DAY);
    const p = (x) => String(x).padStart(2, "0");
    const key = `${day.getFullYear()}-${p(day.getMonth() + 1)}-${p(day.getDate())}`;
    const h = state.history[key] || { reviews: 0, correct: 0, quizzes: 0, quizCorrect: 0, quests: 0 };
    out.push({ key, label: `${day.getMonth() + 1}/${day.getDate()}`, ...h });
  }
  return out;
}

/* ---------------- 口语闯关 / 游戏化进度 ---------------- */

const XP_PER_LEVEL = 200;

export function questState() {
  return state.quest;
}

/** 经验与等级 */
export function levelInfo() {
  const xp = state.quest.xp || 0;
  const level = 1 + Math.floor(xp / XP_PER_LEVEL);
  const into = xp % XP_PER_LEVEL;
  return { xp, level, into, need: XP_PER_LEVEL, pct: (into / XP_PER_LEVEL) * 100 };
}

export function addXp(amount) {
  if (!amount) return null;
  const before = levelInfo().level;
  state.quest.xp = Math.max(0, (state.quest.xp || 0) + amount);
  const after = levelInfo().level;
  commit();
  return { gained: amount, leveledUp: after > before, level: after };
}

export function stageResult(stageId) {
  return state.quest.stages[stageId] || null;
}

/** 保存一次闯关结果（星星只保留最好成绩） */
export function saveStageResult(stageId, { stars, score, xp }) {
  const prev = state.quest.stages[stageId] || { stars: 0, best: 0, plays: 0, cleared: 0 };
  const next = {
    stars: Math.max(prev.stars, stars),
    best: Math.max(prev.best, Math.round(score)),
    plays: prev.plays + 1,
    cleared: prev.cleared + (stars > 0 ? 1 : 0),
    last: today(),
  };
  state.quest.stages[stageId] = next;
  if (xp) state.quest.xp = Math.max(0, (state.quest.xp || 0) + xp);
  bumpHistory((h) => ({ quests: (h.quests || 0) + 1 }));
  commit();
  return next;
}

export function totalStars() {
  return Object.values(state.quest.stages).reduce((s, v) => s + (v.stars || 0), 0);
}

export function achievement(id) {
  return !!state.quest.achievements[id];
}

/** 解锁成就，返回是否本次新解锁 */
export function awardAchievement(id) {
  if (state.quest.achievements[id]) return false;
  state.quest.achievements[id] = Date.now();
  commit();
  return true;
}

export function achievementList() {
  return Object.keys(state.quest.achievements);
}

/* ---------------- 技能成长（全方位水平） ---------------- */

export const SKILLS = [
  { id: "vocab", label: "单词", emoji: "📗" },
  { id: "grammar", label: "语法", emoji: "📐" },
  { id: "kanji", label: "汉字", emoji: "🈶" },
  { id: "listening", label: "听力", emoji: "🎧" },
  { id: "speaking", label: "口语", emoji: "🎤" },
];

const SKILL_STEPS = [0, 20, 60, 120, 200];

export function recordSkill(id, correct) {
  const s = state.skills[id] || (state.skills[id] = { seen: 0, correct: 0 });
  s.seen += 1;
  if (correct) s.correct += 1;
  commit();
  return s;
}

export function skillStats() {
  return SKILLS.map(({ id, label, emoji }) => {
    const s = state.skills[id] || { seen: 0, correct: 0 };
    let level = 1;
    for (let i = 0; i < SKILL_STEPS.length; i++) if (s.correct >= SKILL_STEPS[i]) level = i + 1;
    const nextAt = SKILL_STEPS[level] ?? null;
    const prevAt = SKILL_STEPS[level - 1] ?? 0;
    return {
      id,
      label,
      emoji,
      seen: s.seen,
      correct: s.correct,
      accuracy: s.seen ? s.correct / s.seen : 0,
      level,
      nextAt,
      pct: nextAt ? ((s.correct - prevAt) / (nextAt - prevAt)) * 100 : 100,
    };
  });
}

/** 综合水平分（0~100）：技能等级 + 正确率的加权，用于首页「全方位」展示 */
export function overallScore() {
  const stats = skillStats();
  const lv = stats.reduce((s, x) => s + x.level, 0) / (stats.length * SKILL_STEPS.length);
  const acc = stats.reduce((s, x) => s + (x.seen ? x.accuracy : 0), 0) / stats.length;
  return Math.round((lv * 0.6 + acc * 0.4) * 100);
}


export function resetAll() {
  state = structuredClone(DEFAULT);
  commit();
}
