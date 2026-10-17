// 口语闯关关卡数据（本项目原创，MIT）
//
// 关卡结构：
//   { id, title, level, emoji, desc, items: [{ ja, kana, romaji, zh }] }
//   ja   = 日语原文（显示用，可以是汉字）
//   kana = 假名读法（打分用，必须全假名，最稳）
//   zh   = 中文意思（提示用）

export const STAGES = [
  {
    id: "n5-greet",
    level: "N5",
    emoji: "🙇",
    title: "はじめての あいさつ",
    desc: "问候与礼貌用语",
    items: [
      { ja: "こんにちは", kana: "こんにちは", romaji: "konnichiwa", zh: "你好（白天）" },
      { ja: "おはようございます", kana: "おはようございます", romaji: "ohayou gozaimasu", zh: "早上好（礼貌）" },
      { ja: "こんばんは", kana: "こんばんは", romaji: "konbanwa", zh: "晚上好" },
      { ja: "ありがとうございます", kana: "ありがとうございます", romaji: "arigatou gozaimasu", zh: "谢谢（礼貌）" },
      { ja: "すみません", kana: "すみません", romaji: "sumimasen", zh: "不好意思／抱歉" },
      { ja: "はじめまして", kana: "はじめまして", romaji: "hajimemashite", zh: "初次见面" },
      { ja: "よろしくおねがいします", kana: "よろしくおねがいします", romaji: "yoroshiku onegaishimasu", zh: "请多关照" },
      { ja: "さようなら", kana: "さようなら", romaji: "sayounara", zh: "再见" },
    ],
  },
  {
    id: "n5-number",
    level: "N5",
    emoji: "🔢",
    title: "かず 1〜10",
    desc: "数字 1 到 10，先把嘴练顺",
    items: [
      { ja: "いち", kana: "いち", romaji: "ichi", zh: "1" },
      { ja: "に", kana: "に", romaji: "ni", zh: "2" },
      { ja: "さん", kana: "さん", romaji: "san", zh: "3" },
      { ja: "よん", kana: "よん", romaji: "yon", zh: "4" },
      { ja: "ご", kana: "ご", romaji: "go", zh: "5" },
      { ja: "ろく", kana: "ろく", romaji: "roku", zh: "6" },
      { ja: "なな", kana: "なな", romaji: "nana", zh: "7" },
      { ja: "はち", kana: "はち", romaji: "hachi", zh: "8" },
      { ja: "きゅう", kana: "きゅう", romaji: "kyuu", zh: "9" },
      { ja: "じゅう", kana: "じゅう", romaji: "juu", zh: "10" },
    ],
  },
  {
    id: "n5-family",
    level: "N5",
    emoji: "👨‍👩‍👧",
    title: "かぞく",
    desc: "家人称呼",
    items: [
      { ja: "おかあさん", kana: "おかあさん", romaji: "okaasan", zh: "妈妈" },
      { ja: "おとうさん", kana: "おとうさん", romaji: "otousan", zh: "爸爸" },
      { ja: "おにいさん", kana: "おにいさん", romaji: "oniisan", zh: "哥哥" },
      { ja: "おねえさん", kana: "おねえさん", romaji: "oneesan", zh: "姐姐" },
      { ja: "おとうと", kana: "おとうと", romaji: "otouto", zh: "弟弟" },
      { ja: "いもうと", kana: "いもうと", romaji: "imouto", zh: "妹妹" },
      { ja: "おばあさん", kana: "おばあさん", romaji: "obaasan", zh: "奶奶／外婆" },
      { ja: "おじいさん", kana: "おじいさん", romaji: "ojiisan", zh: "爷爷／外公" },
    ],
  },
  {
    id: "n5-food",
    level: "N5",
    emoji: "🍙",
    title: "たべもの",
    desc: "食物与饮品",
    items: [
      { ja: "みず", kana: "みず", romaji: "mizu", zh: "水" },
      { ja: "おちゃ", kana: "おちゃ", romaji: "ocha", zh: "茶" },
      { ja: "ごはん", kana: "ごはん", romaji: "gohan", zh: "米饭／饭" },
      { ja: "さかな", kana: "さかな", romaji: "sakana", zh: "鱼" },
      { ja: "にく", kana: "にく", romaji: "niku", zh: "肉" },
      { ja: "たまご", kana: "たまご", romaji: "tamago", zh: "鸡蛋" },
      { ja: "やさい", kana: "やさい", romaji: "yasai", zh: "蔬菜" },
      { ja: "くだもの", kana: "くだもの", romaji: "kudamono", zh: "水果" },
    ],
  },
  {
    id: "n5-daily",
    level: "N5",
    emoji: "🏠",
    title: "まいにちの ことば",
    desc: "出门、回家、吃饭时的固定说法",
    items: [
      { ja: "いってきます", kana: "いってきます", romaji: "ittekimasu", zh: "我出门了" },
      { ja: "いってらっしゃい", kana: "いってらっしゃい", romaji: "itterasshai", zh: "路上小心（对出门的人说）" },
      { ja: "ただいま", kana: "ただいま", romaji: "tadaima", zh: "我回来了" },
      { ja: "おかえりなさい", kana: "おかえりなさい", romaji: "okaerinasai", zh: "你回来啦" },
      { ja: "いただきます", kana: "いただきます", romaji: "itadakimasu", zh: "我开动了" },
      { ja: "ごちそうさま", kana: "ごちそうさま", romaji: "gochisousama", zh: "谢谢招待／吃饱了" },
      { ja: "おやすみなさい", kana: "おやすみなさい", romaji: "oyasuminasai", zh: "晚安" },
      { ja: "おねがいします", kana: "おねがいします", romaji: "onegaishimasu", zh: "麻烦你了／拜托" },
    ],
  },
  {
    id: "n5-sentence",
    level: "N5",
    emoji: "🗣️",
    title: "はじめての ぶん",
    desc: "最简单的完整句子",
    items: [
      { ja: "わたしは がくせい です", kana: "わたしはがくせいです", romaji: "watashi wa gakusei desu", zh: "我是学生" },
      { ja: "これは なんですか", kana: "これはなんですか", romaji: "kore wa nan desu ka", zh: "这是什么？" },
      { ja: "にほんごを べんきょうしています", kana: "にほんごをべんきょうしています", romaji: "nihongo o benkyou shiteimasu", zh: "我在学日语" },
      { ja: "みずを ください", kana: "みずをください", romaji: "mizu o kudasai", zh: "请给我水" },
      { ja: "きょうは あついですね", kana: "きょうはあついですね", romaji: "kyou wa atsui desu ne", zh: "今天真热啊" },
      { ja: "えいがを みたいです", kana: "えいがをみたいです", romaji: "eiga o mitai desu", zh: "我想看电影" },
      { ja: "とうきょうに いきたいです", kana: "とうきょうにいきたいです", romaji: "toukyou ni ikitai desu", zh: "我想去东京" },
      { ja: "にほんりょうりが すきです", kana: "にほんりょうりがすきです", romaji: "nihon ryouri ga suki desu", zh: "我喜欢日本料理" },
    ],
  },
  {
    id: "n4-shop",
    level: "N4",
    emoji: "🏪",
    title: "おみせで",
    desc: "在店里点单、结账",
    items: [
      { ja: "すみません、メニューを おねがいします", kana: "すみませんめにゅーをおねがいします", romaji: "sumimasen, menyuu o onegaishimasu", zh: "不好意思，请给我菜单" },
      { ja: "これを ください", kana: "これをください", romaji: "kore o kudasai", zh: "请给我这个" },
      { ja: "いくらですか", kana: "いくらですか", romaji: "ikura desu ka", zh: "多少钱？" },
      { ja: "カードで はらえますか", kana: "かーどではらえますか", romaji: "kaado de haraemasu ka", zh: "可以刷卡吗？" },
      { ja: "おすすめは なんですか", kana: "おすすめはなんですか", romaji: "osusume wa nan desu ka", zh: "有什么推荐的？" },
      { ja: "おかいけいを おねがいします", kana: "おかいけいをおねがいします", romaji: "okaikei o onegaishimasu", zh: "请结账" },
      { ja: "とても おいしかったです", kana: "とてもおいしかったです", romaji: "totemo oishikatta desu", zh: "非常好吃" },
      { ja: "また きます", kana: "またきます", romaji: "mata kimasu", zh: "我还会再来的" },
    ],
  },
  {
    id: "n4-daily",
    level: "N4",
    emoji: "💬",
    title: "まいにちの かいわ",
    desc: "日常对话常用句",
    items: [
      { ja: "しゅうまつは なにを しますか", kana: "しゅうまつはなにをしますか", romaji: "shuumatsu wa nani o shimasu ka", zh: "周末你做什么？" },
      { ja: "でんしゃに のって かいしゃへ いきます", kana: "でんしゃにのってかいしゃへいきます", romaji: "densha ni notte kaisha e ikimasu", zh: "坐电车去公司" },
      { ja: "にほんごが じょうずに なりましたね", kana: "にほんごがじょうずになりましたね", romaji: "nihongo ga jouzu ni narimashita ne", zh: "你的日语变好了呢" },
      { ja: "ちょっと まって ください", kana: "ちょっとまってください", romaji: "chotto matte kudasai", zh: "请稍等一下" },
      { ja: "この みちを まっすぐ いって ください", kana: "このみちをまっすぐいってください", romaji: "kono michi o massugu itte kudasai", zh: "请沿这条路直走" },
      { ja: "あしたは あめが ふるそうです", kana: "あしたはあめがふるそうです", romaji: "ashita wa ame ga furu sou desu", zh: "听说明天会下雨" },
      { ja: "りょこうの よていは ありますか", kana: "りょこうのよていはありますか", romaji: "ryokou no yotei wa arimasu ka", zh: "有旅行的计划吗？" },
      { ja: "むりを しないで くださいね", kana: "むりをしないでくださいね", romaji: "muri o shinaide kudasai ne", zh: "请不要勉强自己" },
    ],
  },
  {
    id: "n3-daily",
    level: "N3",
    emoji: "🌏",
    title: "ちょっと ふくざつな はなし",
    desc: "更自然的表达",
    items: [
      { ja: "にほんに きた ばかりなので、まだ なれていません", kana: "にほんにきたばかりなのでまだなれていません", romaji: "nihon ni kita bakari nanode, mada nareteimasen", zh: "我刚来日本，还不太习惯" },
      { ja: "こまった ことが あったら、いつでも いってください", kana: "こまったことがあったらいつでもいってください", romaji: "komatta koto ga attara, itsudemo itte kudasai", zh: "有困难的话请随时告诉我" },
      { ja: "この へんは よるも あんぜんなので、あるいて かえれます", kana: "このへんはよるもあんぜんなのであるいてかえれます", romaji: "kono hen wa yoru mo anzen nanode, aruite kaeremasu", zh: "这一带晚上也安全，可以走回去" },
      { ja: "しごとが おわったら、いっしょに ごはんを たべませんか", kana: "しごとがおわったらいっしょにごはんをたべませんか", romaji: "shigoto ga owattara, issho ni gohan o tabemasen ka", zh: "工作结束后，要不要一起吃饭？" },
      { ja: "にほんごを はなす れんしゅうを しています", kana: "にほんごをはなすれんしゅうをしています", romaji: "nihongo o hanasu renshuu o shiteimasu", zh: "我在练习说日语" },
      { ja: "きょうは あまり ちょうしが よくないです", kana: "きょうはあまりちょうしがよくないです", romaji: "kyou wa amari choushi ga yokunai desu", zh: "今天状态不太好" },
      { ja: "ゆっくり いってくれれば、わかります", kana: "ゆっくりいってくれればわかります", romaji: "yukkuri itte kurereba, wakarimasu", zh: "如果你说得慢一点，我能听懂" },
      { ja: "もう いちど おしえて いただけますか", kana: "もういちどおしえていただけますか", romaji: "mou ichido oshiete itadakemasu ka", zh: "能再教我一次吗？" },
    ],
  },
];

export const ACHIEVEMENTS = [
  { id: "first-clear", emoji: "🌱", label: "初次通关", desc: "完成任意一个关卡" },
  { id: "three-stars", emoji: "⭐", label: "满星关卡", desc: "拿到一次三星" },
  { id: "no-miss", emoji: "🎯", label: "零失误", desc: "一关全部答对" },
  { id: "combo-5", emoji: "🔥", label: "五连击", desc: "连续答对 5 题" },
  { id: "combo-10", emoji: "⚡", label: "十连击", desc: "连续答对 10 题" },
  { id: "survivor", emoji: "❤️", label: "毫发无伤", desc: "不掉一颗心通关" },
  { id: "boss-n5", emoji: "🈴", label: "N5 试炼达成", desc: "通关 N5 综合试炼" },
  { id: "boss-n4", emoji: "🈶", label: "N4 试炼达成", desc: "通关 N4 综合试炼" },
  { id: "all-rounder", emoji: "🧭", label: "全方位", desc: "五个技能都达到 2 级" },
  { id: "level-5", emoji: "🎖️", label: "等级 5", desc: "累计经验达到 800" },
  { id: "stars-30", emoji: "🌟", label: "集星 30", desc: "累计获得 30 颗星" },
  { id: "level-clear", emoji: "🗾", label: "通关 N5 路线", desc: "N5 全部关卡都拿到星星" },
];


export function allSpeakItems() {
  return STAGES.flatMap((s) => s.items);
}

/** 用语法数据自动生成「例句跟读」关卡（每关 8 句） */
export async function buildGrammarStage(level, index = 0) {
  const { loadGrammar, loadGrammarZh } = await import("./data.js");
  const { stripFurigana } = await import("./furigana.js");
  const { grammarPattern } = await import("./gloss.js");
  const [grammar, zhTable] = await Promise.all([loadGrammar(level), loadGrammarZh(level)]);
  const items = [];
  for (const g of grammar) {
    for (const ex of g.examples || []) {
      const kana = readingOf(ex);
      if (!kana || kana.length < 5 || kana.length > 40) continue;
      const gz = zhTable[g.id]?.m || "";
      const pat = grammarPattern(g, zhTable);
      items.push({
        ja: stripFurigana(ex.ja),
        kana,
        romaji: "",
        // 跟读提示用中文：句型 + 人工中文释义（不用英文例句翻译）
        zh: `句型「${pat}」${gz ? `：${gz}` : ""}`,
        tip: `语法：${pat}`,
      });
      if (items.length >= 8) break;
    }
    if (items.length >= 8) break;
  }
  if (items.length < 4) return null;
  return {
    id: `grammar-${level.toLowerCase()}-${index}`,
    level,
    emoji: "📖",
    title: `${level} 例句跟读`,
    desc: `${level} 语法例句（${items.length} 句）`,
    generated: true,
    items,
  };
}

/** 从 {漢字|かんじ} 标记里取出纯假名读法 */
function readingOf(ex) {
  if (!ex?.ja) return "";
  if (!ex.furigana) return String(ex.ja).replace(/[。、！？]/g, "");
  return String(ex.furigana)
    .replace(/\{([^{}|]+)\|([^{}]+)\}/g, "$2")
    .replace(/[\s\u3000]/g, "")
    .replace(/[。、！？]/g, "");
}
