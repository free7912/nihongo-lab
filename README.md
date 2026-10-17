# 日本語ラボ（Nihongo Lab）

一个零构建的纯静态日语学习网站：**N5 → N1 游戏化闯关（单词 / 汉字 / 语法 / 听力 / 口语）+ 五十音 + 闪卡复习**，进度保存在浏览器 localStorage。

没有 Node、没有打包工具，下载即可运行，直接丢到 GitHub Pages 就能上线。

## 核心玩法：闯关路线

一条从 **N5 到 N1** 的主线，每个等级 9 关，共 45 关，下一关要靠实力解锁：

| 关卡 | 题目类型 | 练的能力 |
| --- | --- | --- |
| 📗 单词 · 认词 | 看日语单词选中文意思 | 单词 |
| 📘 单词 · 想词 | 看中文意思选单词 / 选读音 | 单词 |
| 🎧 单词 · 听音 | 只播发音，凭听力选词 | 听力 |
| 🈶 汉字 · 音训 | 汉字的意思与读音 | 汉字 |
| 📐 语法 · 句型 | 句型 ↔ 中文意思 | 语法 |
| 📝 语法 · 例句 | 看带注音的例句判断用了哪个句型 | 语法 |
| 🎤 口语 · 跟读 | 跟读单词与短句（语音评分） | 口语 |
| 🗣️ 口语 · 成句 | 说完整句子 | 口语 |
| 👑 综合试炼 | 单词 + 汉字 + 语法 + 听力 + 口语混合 12 题 | 全方位 |

- **游戏机制**：3 颗心（错 3 次挑战失败）、连击加成、每关 1–3 星、经验值与等级、11 个成就徽章。
- **全方位水平**：单词 / 语法 / 汉字 / 听力 / 口语 五项各自有技能等级与正确率，
  首页和统计页用同一条「综合水平分」汇总，避免偏科。
- **题目自动生成**：所有关卡都由内置题库按固定种子编排（同一关题目稳定、选项顺序会变），
  单词 7811 条、汉字 2383 字、语法 526 条都能被覆盖到。
- **口语**：桌面版 Chrome / Edge 支持 Web Speech 语音识别（需联网 + 麦克风授权），
  自动打分并给星级；不支持时自动切换为「听示范 → 自己判断」的自评模式。
- **音效**：Web Audio 合成音（答对 / 答错 / 升级 / 通关），右上角 🔊 可静音。

## 功能

| 页面 | 说明 |
| --- | --- |
| 首页 | 综合水平分、该闯的下一关、全方位五项技能条、14 天练习柱状图、分级掌握度 |
| 闯关 | N5–N1 关卡地图、星级、生命、连击、经验、成就、口语评分 |
| 五十音 | 平/片假名 104 音（清音、浊音、拗音），点击朗读，罗马字可隐藏，错得多的假名会标红 |
| 假名测验 | 看假名选罗马字 / 看罗马字选假名，可选范围、题数，答错自动记录，也给经验 |
| 单词 | JLPT N5–N1 共 7811 词，中文释义 + 英文对照，可搜索、标记掌握、加入复习队列、例句朗读 |
| 汉字 | N5–N1 共 2383 字，音读/训读/名乘/部首/笔画数/频率，可朗读 |
| 语法 | N5–N1 共 526 条句型，中文释义 + 接续 + 带注音的例句 |
| 闪卡复习 | 类 SM-2 间隔重复：忘记 / 困难 / 记得 / 简单，键盘 `空格` 翻面、`1`–`4` 评分，也给经验 |
| 统计 | 等级、星星、综合水平分、闯关路线进度、正确率、分级进度、导出/清空进度 |

## 本地运行

因为使用了 ES Module 和 `fetch` 读取 JSON，必须通过 HTTP 打开（不能直接双击 `index.html`）。

```bash
# 方式一：Python（Windows 自带 python 即可）
cd nihongo-lab
python -m http.server 8000
# 或者用项目自带的免缓存开发服务器（推荐，改完代码刷新即生效）
python tools/serve.py 8000
# 然后浏览器打开 http://localhost:8000

# 方式二：VS Code 装 "Live Server" 插件，右键 index.html → Open with Live Server

# 方式三：Node 环境
npx serve .
```

> 口语关卡需要**麦克风 + 联网**（Web Speech 识别由浏览器厂商的服务器提供）。
> 不支持时会自动降级为自评模式，其余关卡完全离线可用。

## 自检脚本

项目自带两套自检：**Node 端逻辑自检** + **真实浏览器冒烟测试**。

### 1. Node 端自检（零依赖）

覆盖五十音数据、闯关题目生成、技能/等级系统、语音打分算法和所有模块能否加载：

```bash
node tools/selftest.mjs

# 没装 Node、但有 VS Code 时（借用 VS Code 自带的 Electron 当 Node 用）
# PowerShell：
$env:ELECTRON_RUN_AS_NODE=1; & "E:\Microsoft VS Code\Code.exe" tools/selftest.mjs
```

### 2. 浏览器冒烟测试（真实 DOM + 真实数据）

```bash
python tools/serve.py 8000
# 然后打开 http://localhost:8000/tools/browser-test.html
```

它会挂载全部页面，并自动跑一遍「单词 · 认词」「单词 · 听音」「口语 · 跟读」「综合试炼」四关：
检查题目数量与类型、爱心/连击/经验、失败与成功两种结算页、语音识别通过的评分面板、
以及**被标为正确的选项是否真的和解析一致**（防止题目映射出错）。
口语部分用内置的识别桩模拟「识别成功」和「识别连续失败 → 自动切自评」两条路径。

也可以用无头 Chrome 自动跑并把结果 POST 回来：

```bash
# 先起一个收集端（任意能收 POST 的地址都行），再：
chrome --headless=new "http://localhost:8000/tools/browser-test.html?report=http://127.0.0.1:8180/report"
```

## 中文释义是怎么来的

OpenJLPT 的释义是英文（`"to meet"`、`"rice bowl"`），而本站面向中文用户，
所以有一个**可选的构建步骤**把释义翻成中文，结果随站点一起发布，运行时依然是纯静态：

```bash
python tools/translate.py --report    # 查看进度
python tools/translate.py             # 增量翻译（结果缓存在 tools/.zh-cache.json，已 gitignore）
python tools/translate.py --clean     # 剔除缓存里明显不合格的译文后重翻
python tools/translate.py --normalize # 不联网，只整理已有缓存并重写 data/zh
```

- 生成物：`data/zh/n5.json` ~ `data/zh/n1.json`（`{"to meet": "见面；遇见", ...}`），随仓库一起提交。
- 约 89% 的释义有中文；剩余的多是长句/罕见搭配，会自动回退显示英文原文（页面不会报错）。
- 译文来自公开词典接口，**属于机器翻译，个别词条可能不准确**；想手工修正就写进 `tools/zh-overrides.json` 再跑一次脚本。

## 部署到 GitHub Pages

1. 把仓库推到 GitHub（分支 `main`）。
2. 仓库 **Settings → Pages → Build and deployment**：
   - Source 选 **Deploy from a branch**
   - Branch 选 `main`，目录选 **/ (root)**
3. 保存后等 1 分钟左右，访问 `https://<用户名>.github.io/<仓库名>/`。

因为项目里没有任何构建步骤，直接发布根目录即可；也不需要在仓库里放 `.nojekyll`
（若以后新增以 `_` 开头的目录，请添加一个空的 `.nojekyll` 文件）。

## 目录结构

```
nihongo-lab/
├── index.html                 # 页面外壳 + 导航
├── assets/
│   ├── css/style.css          # 设计系统（含深色模式）+ 闯关 UI
│   └── js/
│       ├── app.js             # hash 路由 + 导航（每次渲染使用全新容器）
│       ├── store.js           # localStorage 进度、SRS、经验/技能/成就
│       ├── quest-engine.js    # 把题库编排成 N5–N1 关卡与题目
│       ├── quest-data.js      # 原创口语素材 + 成就定义
│       ├── speech-recog.js    # 语音识别评分（相似度算法）
│       ├── sfx.js             # Web Audio 合成音效
│       ├── gloss.js           # 中文释义层（缺译文回退英文）
│       ├── data.js            # 按等级懒加载 JSON
│       ├── speech.js          # 浏览器语音合成朗读日语
│       ├── furigana.js        # {漢字|かんじ} → <ruby>
│       ├── kana-data.js       # 五十音数据（原创）
│       └── views/             # 各页面（home / quest / kana / quiz / vocab / kanji / grammar / cards / stats）
├── data/                      # OpenJLPT 题库（vocab / kanji / grammar，N5–N1）
│   └── zh/                    # 构建时生成的中文释义
├── tools/                     # 开发脚本：serve.py / translate.py / selftest.mjs / browser-test.html
└── vendor/openjlpt/           # 上游 LICENSE 与 NOTICE（遵守署名要求）
```

## 数据与许可

- **代码**：MIT（见 `LICENSE`）。
- **题库**：来自 [OpenJLPT](https://github.com/evanclan/OpenJLPT)，CC BY-SA 4.0，
  上游为 JMdict、KANJIDIC2（EDRDG）、Jonathan Waller 的 JLPT 词表、Tatoeba。
  详见 `ATTRIBUTION.md`。**分发修改后的数据（含 `data/zh/` 译文）必须同样以 CC BY-SA 4.0 发布并署名。**
- 五十音数据、闯关编排、原创口语素材、成就与音效均为本项目原创。

## 后续可做

- [ ] 汉字笔顺动画（可接入 KanjiVG，CC BY-SA 3.0）
- [ ] 假名手写识别 / 书写练习
- [ ] 每日学习目标与提醒、连续打卡奖励
- [ ] 语法填空（自动挖空例句中的助词）
- [ ] 听力专项（JLPT 听力模拟题）
- [ ] 学习进度云端同步（需后端或 GitHub Gist）
