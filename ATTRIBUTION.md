# 数据来源与许可（ATTRIBUTION）

## 题库数据：OpenJLPT

`data/vocab/*.json`、`data/kanji/*.json`、`data/grammar/*.json`、`data/meta/*.json`
均来自 [OpenJLPT](https://github.com/evanclan/OpenJLPT)（版本 0.3.0），许可为
**CC BY-SA 4.0**。上游许可原文见 `vendor/openjlpt/LICENSE`，上游声明见 `vendor/openjlpt/NOTICE.md`。

> Contains data from [OpenJLPT](https://github.com/evanclan/OpenJLPT) (CC BY-SA 4.0),
> which uses JMdict and KANJIDIC2 (EDRDG), Jonathan Waller's JLPT lists, and Tatoeba.

### OpenJLPT 使用的上游数据

| 来源 | 用途 | 许可 |
| --- | --- | --- |
| Jonathan Waller's JLPT Resources (tanos.co.uk) | N5–N1 等级划分、英文释义 | CC BY |
| JMdict — EDRDG | 词条、读音、词性 | CC BY-SA 4.0 |
| KANJIDIC2 — EDRDG | 汉字读音、部首、笔画 | CC BY-SA 4.0 |
| Tatoeba | 例句 | CC BY 2.0 FR |

### 使用要求

1. 署名 OpenJLPT 及上述上游来源；
2. 附上 CC BY-SA 4.0 许可链接（<https://creativecommons.org/licenses/by-sa/4.0/>）；
3. **修改后的数据集必须以 CC BY-SA 4.0 分发（ShareAlike）**。

### 中文释义（本项目生成的衍生数据）

`data/zh/*.json` 是把 OpenJLPT 的英文释义批量翻译成中文的结果（生成脚本 `tools/translate.py`，
缓存于 `tools/.zh-cache.json`，可用 `tools/zh-overrides.json` 手工修正）。

它属于 **OpenJLPT 数据的衍生作品**，因此同样以 **CC BY-SA 4.0** 发布：
如果你分发、修改 `data/zh/`，请一并保留上面的署名与许可，并以相同许可分发。

## 本项目原创内容

- `assets/js/kana-data.js` 五十音数据
- `assets/js/quest-engine.js` / `quest-data.js`：关卡编排、原创口语跟读素材、成就定义
- `assets/js/sfx.js`：Web Audio 合成音效
- 全部界面代码、设计与文案

以上部分以 MIT 许可发布（见 `LICENSE`）。
