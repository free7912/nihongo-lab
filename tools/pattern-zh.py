"""把句型里上游自带的英文小括号标签换成中文（例如 〜に（time）→ 〜に（时间））。

保持 data/grammar-zh/*.json 的现有排版：只在 "id": { 后面插入 "p": "…" 字段。
可重复执行（已有 p 字段的会跳过）。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PATTERN_ZH = {
    # N5
    "ga-subject": "〜が（主语）",
    "ni-time": "〜に（时间）",
    "ni-destination": "〜に（目的地）",
    "ni-location": "〜に（存在的地点）",
    "ni-indirect-object": "〜に（间接宾语）",
    "ni-frequency": "〜に（频率）",
    "de-place": "〜で（动作地点）",
    "de-means": "〜で（手段）",
    "to-and": "〜と（并列）",
    "to-with": "〜と（共同）",
    "ka-or": "〜か（选择）",
    "no": "〜の（所属）",
    "kara-from": "〜から（起点）",
    "made": "〜まで（终点）",
    "ka-question": "〜か（疑问）",
    "nagara": "〜ながら（同时）",
    "kara-reason": "〜から（原因）",
    "ga-but": "〜が（转折）",
    "ni-suru": "〜にする（决定）",
    "kurai-gurai": "〜くらい / 〜ぐらい（大约）",
    "na-na-adjective": "〜な（な形容词）",
    "to-iu-named": "〜という（名称）",
    # N4
    "sou-da-appearance": "〜そうだ（样态）",
    "sou-da-hearsay": "〜そうだ（传闻）",
    "rashii": "〜らしい（传闻／推测）",
    "eru-rareru-potential": "〜える / 〜られる（可能）",
    "reru-rareru-passive": "〜れる / 〜られる（被动）",
    "na-prohibition": "〜な（禁止）",
    "to": "〜と（条件）",
    "noni-although": "〜のに（转折）",
    "noni-purpose": "〜のに（用途）",
    "te-reason": "〜て（原因）",
    "you-ni": "〜ように（目的）",
    "ka-embedded-question": "〜か（间接疑问）",
    "mo-emphasis": "〜も（强调）",
    "no-koto-nominalizer": "〜の / 〜こと（名词化）",
    "de-mo-suggestion": "〜でも（提议）",
    "ku-suru-ni-suru": "〜くする / 〜にする（使成为）",
    # N3
    "koto-instruction": "〜こと（规定）",
    "rashii-typical-of": "〜らしい（典型）",
    "you-na-you-ni-like": "〜ような / 〜ように（比拟）",
    "kurai-gurai-extent": "〜くらい / 〜ぐらい（程度）",
    "toka-hearsay": "〜とか（传闻）",
    "made-even": "〜まで（极端）",
}

LEVELS = ["n5", "n4", "n3", "n2", "n1"]

# 先核对：真实句型里含英文字母的，必须都在上表里
missing = []
for lv in LEVELS:
    data = json.load(open(os.path.join(ROOT, "data", "grammar", f"{lv}.json"), encoding="utf-8"))
    for item in data:
        if re.search(r"[A-Za-z]", item["pattern"]) and item["id"] not in PATTERN_ZH:
            missing.append((lv, item["id"], item["pattern"]))
    for item in data:
        if item["id"] in PATTERN_ZH:
            want = PATTERN_ZH[item["id"]]
            # 句型骨架（去掉括号部分）应当一致，只替换括号里的说明
            base = re.sub(r"[（(].*?[）)]", "", item["pattern"]).strip()
            if base and base not in want:
                missing.append((lv, item["id"], f"骨架不符：{item['pattern']} vs {want}"))
if missing:
    print("以下句型未被正确处理：")
    for row in missing:
        print("  ", row)
    sys.exit(1)

changed = 0
for lv in LEVELS:
    path = os.path.join(ROOT, "data", "grammar-zh", f"{lv}.json")
    text = open(path, encoding="utf-8").read()
    for gid, pat in PATTERN_ZH.items():
        if f'"{gid}":' not in text:
            continue
        if f'"{gid}": {{ "p"' in text:
            continue
        text = text.replace(f'"{gid}": {{ "m"', f'"{gid}": {{ "p": "{pat}", "m"', 1)
        changed += 1
    json.loads(text)  # 校验 JSON 合法
    open(path, "w", encoding="utf-8").write(text)

print(f"已写入 {changed} 条句型中文标签（共 {len(PATTERN_ZH)} 条映射）")
