// 数据加载：按等级懒加载 OpenJLPT 的 JSON（CC BY-SA 4.0）
const cache = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(path) {
  // 弱网 / 文件正在被写入时可能偶发失败，重试两次再放弃
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(path, { cache: "force-cache" });
      if (!res.ok) throw new Error(`加载失败 ${path} (${res.status})`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 2) await sleep(200 + attempt * 400);
    }
  }
  throw lastErr;
}

async function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetchJson(path).catch((err) => {
    cache.delete(path); // 失败不缓存，下次访问可重试
    throw err;
  });
  cache.set(path, promise);
  return promise;
}

const lv = (level) => String(level).toLowerCase();

export const loadVocab = (level) => loadJson(`data/vocab/${lv(level)}.json`);
export const loadKanji = (level) => loadJson(`data/kanji/${lv(level)}.json`);
export const loadGrammar = (level) => loadJson(`data/grammar/${lv(level)}.json`);
export const loadMeta = () => loadJson("data/meta/meta.json");
export const loadPos = () => loadJson("data/meta/pos.json");

/** 中文释义表（构建时由 tools/translate.py 生成）；缺文件时返回空表 */
export async function loadZh(level) {
  try {
    return await loadJson(`data/zh/${lv(level)}.json`);
  } catch {
    return {};
  }
}

/** 语法逐条中文释义（人工撰写，随仓库发布）；缺文件时返回空表 */
export async function loadGrammarZh(level) {
  try {
    return await loadJson(`data/grammar-zh/${lv(level)}.json`);
  } catch {
    return {};
  }
}

/** 全等级合并（首次使用较慢，之后走缓存） */
export async function loadAll(kind) {
  const { LEVELS } = await import("./util.js");
  const loader = { vocab: loadVocab, kanji: loadKanji, grammar: loadGrammar }[kind];
  const lists = await Promise.all(LEVELS.map((l) => loader(l)));
  return lists.flat();
}
