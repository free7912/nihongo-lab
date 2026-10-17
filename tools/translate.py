#!/usr/bin/env python3
"""把 OpenJLPT 的英文释义批量翻成中文，生成 data/zh/*.json 供前端使用。

为什么要这一步：OpenJLPT 的释义是英文（"to meet" / "rice bowl"），
而本站是中文站点，闯关题目（看词选意思、看意思选词、汉字选意思、语法句型）
都需要中文释义。这些译文在“构建时”生成并随站点一起发布，
所以站点本身仍然是纯静态、离线可用的。

用法：
    python tools/translate.py            # 增量翻译（已翻译的会跳过）
    python tools/translate.py --limit 50 # 只翻译 50 条，试跑用
    python tools/translate.py --clean    # 剔除不合格译文后重翻
    python tools/translate.py --normalize # 不联网，只整理已有缓存并重写 data/zh
    python tools/translate.py --report   # 只看进度

说明：
  * 结果缓存在 tools/.zh-cache.json，可随时中断、重跑（自动续传）。
  * 逐条写入 data/zh/n5.json ~ n1.json（英文原文 -> 中文），
    所以前端即使在翻译完成前也能用上已翻译的部分。
  * 数据来源是 OpenJLPT（CC BY-SA 4.0），译文属于同一数据的衍生，
    仍然按 CC BY-SA 4.0 发布（见 ATTRIBUTION.md）。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".zh-cache.json")
OUT_DIR = os.path.join(ROOT, "data", "zh")
LEVELS = ["n5", "n4", "n3", "n2", "n1"]
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"}

POS_RE = re.compile(r"^(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art|aux|int|abbr|pl|a)\.\s*", re.I)


def http_get(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def http_post(url: str, data: dict, timeout: int = 20) -> str:
    body = urllib.parse.urlencode(data).encode()
    headers = dict(UA)
    headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


# ---------------------------------------------------------------- 清洗


def normalize_zh(zh: str) -> str:
    """去掉同一译文里重复的义项（例如「楼梯；楼梯」→「楼梯」）。"""
    if not zh:
        return ""
    parts = []
    for p in str(zh).split("；"):
        p = p.strip()
        if p and p not in parts:
            parts.append(p)
    return "；".join(parts)


def clean(text: str, limit: int = 14) -> str:
    """把词典/翻译结果整理成适合做选项的短释义（最多两个义项）。"""
    if not text:
        return ""
    s = str(text).strip()
    s = s.replace("&#39;", "'").replace("&quot;", '"').replace("&amp;", "&")
    s = s.replace("（", "(").replace("）", ")").replace("．", ".").replace("：", ":")
    # 去掉括号补充说明，例如「红绿灯（等于 traffic signals）」
    s = re.sub(r"\([^)]*[A-Za-z][^)]*\)", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("&", "")
    # 去掉词典的领域标签：[人名] [地名] [植] [医] …
    s = re.sub(r"[\[［【][^\]］】]{1,4}[\]］】]", "", s)
    # 词典常在前面加词性：n. / adj. / vt. 等
    while POS_RE.match(s):
        s = POS_RE.sub("", s)
    s = re.sub(r"\b(?:adj|adv|vi|vt|n|v|prep|conj|pron)\.", "", s)
    # 若是「饭碗：指一个人的职业或生计。」这种解释型条目，取冒号前
    s = re.split(r"[：:]", s)[0]
    parts = [POS_RE.sub("", p).strip(" 　.。;；,，'\"") for p in re.split(r"[;；,，、/|]", s)]
    parts = [p for p in parts if p and not p.isascii() and not re.search(r"[A-Za-z]{3,}", p)]
    if not parts:
        return ""
    if len(parts[0]) > limit:
        return parts[0][:limit + 4]
    out = [parts[0]]
    for p in parts[1:]:
        if len("；".join(out)) + len(p) > limit:
            break
        out.append(p)
        if len(out) >= 2:
            break
    return "；".join(out)


# 明显的词典噪声：出现这些标记就认为这条译文不可用
BAD_MARKERS = (
    "第三人称", "过去式", "复数", "等于", "简称", "人名", "地名", "电影", "[", "]", "〈", "〉",
    "同…", "同「", "另见", "参见", "姓氏", "音译",
)


def looks_bad(zh: str) -> bool:
    """判断一条译文是否明显不合格（用于清理旧缓存 / 拒绝新结果）。"""
    if not zh:
        return True
    if not re.search(r"[\u4e00-\u9fff]", zh):
        return True
    if re.search(r"[A-Za-z]{3,}", zh):
        return True
    # 残留的词性标记，例如「在明天；在明日 n. 明天」
    if re.search(r"(?:^|[\s；，,、])(?:n|v|vt|vi|adj|adv|prep|conj|pron)\.", zh):
        return True
    if any(m in zh for m in BAD_MARKERS):
        return True
    return len(zh) > 20


def normalize_query(text: str) -> str:
    """查词典前先整理英文原文，提高命中率。"""
    s = (text or "").strip()
    s = re.sub(r"^\([^)]*\)\s*", "", s)  # 去掉开头的 (humble) / (usually) 等
    s = re.sub(r"\([^)]*\)", "", s)
    s = re.sub(r"^[\"'（(]+|[\"'）)]+$", "", s).strip(" 　.,;")
    return s or (text or "").strip()


# ---------------------------------------------------------------- 翻译源


def via_youdao_dict(text: str) -> str:
    """有道词典（免费 suggest 接口）：短词/短语效果最好。"""
    url = "https://dict.youdao.com/suggest?num=3&ver=3.0&doctype=json&cache=false&le=en&q=" + urllib.parse.quote(text)
    data = json.loads(http_get(url))
    entries = (data.get("data") or {}).get("entries") or []
    for e in entries:
        got = clean(e.get("explain") or e.get("entry") or "")
        if got:
            return got
    return ""


def via_baidu_dict(text: str) -> str:
    """百度词典 sug 接口，作为备用。"""
    data = json.loads(http_post("https://fanyi.baidu.com/sug", {"kw": text}))
    for item in data.get("data") or []:
        got = clean(item.get("v") or "")
        if got:
            return got
    return ""


def via_youdao_mt(text: str) -> str:
    """有道演示翻译接口：整句/带分号的释义用它。"""
    url = "https://aidemo.youdao.com/trans?from=en&to=zh-CHS&q=" + urllib.parse.quote(text)
    data = json.loads(http_get(url))
    tr = data.get("translation") or []
    raw = tr[0] if isinstance(tr, list) and tr else tr
    return clean(raw or "", limit=40)


def translate(text: str) -> tuple[str, str]:
    """返回 (中文, 来源)。失败返回 ("", "")。"""
    text = (text or "").strip()
    if not text:
        return "", ""
    query = normalize_query(text)
    needs_mt = len(query) > 22 or ";" in query or "," in query or query.startswith("to ")
    order = (
        [via_youdao_mt, via_baidu_dict, via_youdao_dict]
        if needs_mt
        else [via_baidu_dict, via_youdao_dict, via_youdao_mt]
    )
    for fn in order:
        try:
            got = fn(query)
        except Exception:
            continue  # 换下一个来源
        if got and not looks_bad(got):
            return got, fn.__name__.replace("via_", "")
    return "", ""


def translate_batch(texts: list[str], workers: int = 8, delay: float = 0.05, on_done=None) -> dict:
    """并发翻译一批文本；返回 {原文: (中文, 来源)}。"""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results: dict = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(lambda t: (t, *translate(t)), t): t for t in texts}
        for fut in as_completed(futures):
            text = futures[fut]
            try:
                _, zh, src = fut.result()
            except Exception:
                zh, src = "", ""
            results[text] = (zh, src)
            if on_done:
                on_done(text, zh, src)
            if delay:
                time.sleep(delay)
    return results


# ---------------------------------------------------------------- 收集待翻译文本


def collect() -> dict[str, set[str]]:
    """按等级收集需要翻译的英文释义。"""
    need: dict[str, set[str]] = {lv: set() for lv in LEVELS}
    for lv in LEVELS:
        path = os.path.join(ROOT, "data", "vocab", f"{lv}.json")
        if os.path.exists(path):
            for item in json.load(open(path, encoding="utf-8")):
                for m in item.get("meanings") or []:
                    need[lv].add(m)
        path = os.path.join(ROOT, "data", "kanji", f"{lv}.json")
        if os.path.exists(path):
            for item in json.load(open(path, encoding="utf-8")):
                for m in item.get("meanings") or []:
                    need[lv].add(m)
        path = os.path.join(ROOT, "data", "grammar", f"{lv}.json")
        if os.path.exists(path):
            for item in json.load(open(path, encoding="utf-8")):
                if item.get("meaning"):
                    need[lv].add(item["meaning"])
    return need


def load_cache() -> dict:
    if os.path.exists(CACHE):
        try:
            return json.load(open(CACHE, encoding="utf-8"))
        except Exception:
            print("缓存文件损坏，重新开始")
    return {}


def save_cache(cache: dict) -> None:
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    tmp = CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=0)
    os.replace(tmp, CACHE)


def write_outputs(need: dict[str, set[str]], cache: dict) -> int:
    """把已翻译的条目按等级写到 data/zh/*.json（顺便去掉重复义项）。"""
    os.makedirs(OUT_DIR, exist_ok=True)
    written = 0
    for lv in LEVELS:
        out = {}
        for text in sorted(need[lv]):
            zh = normalize_zh((cache.get(text) or {}).get("zh") or "")
            if zh:
                out[text] = zh
        with open(os.path.join(OUT_DIR, f"{lv}.json"), "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=0)
        written += len(out)
    return written


def load_overrides() -> dict:
    path = os.path.join(ROOT, "tools", "zh-overrides.json")
    if os.path.exists(path):
        return json.load(open(path, encoding="utf-8"))
    return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="本次最多翻译多少条（0 = 不限）")
    ap.add_argument("--workers", type=int, default=8, help="并发线程数")
    ap.add_argument("--delay", type=float, default=0.0, help="每条之间的间隔秒数")
    ap.add_argument("--report", action="store_true", help="只输出进度")
    ap.add_argument("--clean", action="store_true", help="先剔除缓存里明显不合格的译文，然后重新翻译它们")
    ap.add_argument("--normalize", action="store_true", help="不联网，只整理已有缓存并重写 data/zh/*.json")
    args = ap.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    need = collect()
    cache = load_cache()
    if args.normalize:
        for entry in cache.values():
            if entry and entry.get("zh"):
                entry["zh"] = normalize_zh(entry["zh"])
        save_cache(cache)
        written = write_outputs(need, cache)
        print(f"已整理缓存并重写 data/zh/*.json：共 {written} 条")
        return 0
    if args.clean:
        dropped = [k for k, v in cache.items() if looks_bad((v or {}).get("zh") or "")]
        for k in dropped:
            cache.pop(k, None)
        print(f"清理旧缓存：剔除 {len(dropped)} 条不合格译文，将重新翻译")
    overrides = load_overrides()
    for text, zh in overrides.items():
        cache[text] = {"zh": zh, "src": "override"}

    total = sum(len(v) for v in need.values())
    todo = [t for lv in LEVELS for t in sorted(need[lv]) if not (cache.get(t) or {}).get("zh")]

    print(f"共需 {total} 条释义，已缓存 {total - len(todo)} 条，待翻译 {len(todo)} 条")
    if args.report:
        for lv in LEVELS:
            have = sum(1 for t in need[lv] if (cache.get(t) or {}).get("zh"))
            print(f"  {lv.upper()}: {have}/{len(need[lv])}")
        return 0

    if args.limit:
        todo = todo[: args.limit]

    started = time.time()
    done = 0
    last = {"text": "", "zh": ""}

    def on_done(text, zh, src):
        nonlocal done
        cache[text] = {"zh": zh, "src": src} if zh else {"zh": "", "src": "failed"}
        done += 1
        last["text"], last["zh"] = text, zh
        if done % 25 == 0 or done == len(todo):
            rate = done / max(1e-6, time.time() - started)
            left = (len(todo) - done) / max(rate, 0.01) / 60
            print(
                f"  [{done}/{len(todo)}] {rate:.1f} 条/秒 · 剩余 {left:.1f} 分钟"
                f" · 最近：{text[:26]} -> {zh or '（失败）'}"
            )
            sys.stdout.flush()
        if done % 200 == 0:
            save_cache(cache)
            write_outputs(need, cache)

    translate_batch(todo, workers=args.workers, delay=args.delay, on_done=on_done)
    save_cache(cache)
    written = write_outputs(need, cache)
    failed = [t for t in need.get("n5", set()) | need.get("n4", set()) | need.get("n3", set()) | need.get("n2", set()) | need.get("n1", set()) if not (cache.get(t) or {}).get("zh")]
    ok = total - len(failed)
    print(f"\n翻译完成：{ok}/{total} 条，写入 data/zh/*.json 共 {written} 条")
    if failed:
        print(f"仍有 {len(failed)} 条未翻译（多为长句/罕见表达），例如：")
        for t in failed[:6]:
            print(f"    - {t[:60]}")
        print("  前端会自动回退显示英文原文；也可以加到 tools/zh-overrides.json 手工修正。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
