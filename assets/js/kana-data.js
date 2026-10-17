// 五十音データ（本项目原创，MIT）
//
// 每行格式：{ kana: 平假名, kata: 片假名, romaji: [...] }
//   - 单字符行（清音、浊音）直接连续书写，用全角空格「　」占位空档（如 "や　ゆ　よ"）
//   - 多字符行（拗音，如 きゃ）用 "|" 分隔单元（如 "きゃ|きゅ|きょ"）
//   - romaji 数组必须与单元一一对应，空档用 null

export const SEION_ROWS = [
  { kana: "あいうえお", kata: "アイウエオ", romaji: ["a", "i", "u", "e", "o"] },
  { kana: "かきくけこ", kata: "カキクケコ", romaji: ["ka", "ki", "ku", "ke", "ko"] },
  { kana: "さしすせそ", kata: "サシスセソ", romaji: ["sa", "shi", "su", "se", "so"] },
  { kana: "たちつてと", kata: "タチツテト", romaji: ["ta", "chi", "tsu", "te", "to"] },
  { kana: "なにぬねの", kata: "ナニヌネノ", romaji: ["na", "ni", "nu", "ne", "no"] },
  { kana: "はひふへほ", kata: "ハヒフヘホ", romaji: ["ha", "hi", "fu", "he", "ho"] },
  { kana: "まみむめも", kata: "マミムメモ", romaji: ["ma", "mi", "mu", "me", "mo"] },
  { kana: "や　ゆ　よ", kata: "ヤ　ユ　ヨ", romaji: ["ya", null, "yu", null, "yo"] },
  { kana: "らりるれろ", kata: "ラリルレロ", romaji: ["ra", "ri", "ru", "re", "ro"] },
  { kana: "わ　　を　", kata: "ワ　　ヲ　", romaji: ["wa", null, null, "wo", null] },
  { kana: "ん　　　　", kata: "ン　　　　", romaji: ["n", null, null, null, null] },
];

export const DAKUON_ROWS = [
  { kana: "がぎぐげご", kata: "ガギグゲゴ", romaji: ["ga", "gi", "gu", "ge", "go"] },
  { kana: "ざじずぜぞ", kata: "ザジズゼゾ", romaji: ["za", "ji", "zu", "ze", "zo"] },
  { kana: "だぢづでど", kata: "ダヂヅデド", romaji: ["da", "ji", "zu", "de", "do"] },
  { kana: "ばびぶべぼ", kata: "バビブベボ", romaji: ["ba", "bi", "bu", "be", "bo"] },
  { kana: "ぱぴぷぺぽ", kata: "パピプペポ", romaji: ["pa", "pi", "pu", "pe", "po"] },
];

export const YOON_ROWS = [
  { kana: "きゃ|きゅ|きょ", kata: "キャ|キュ|キョ", romaji: ["kya", "kyu", "kyo"] },
  { kana: "しゃ|しゅ|しょ", kata: "シャ|シュ|ショ", romaji: ["sha", "shu", "sho"] },
  { kana: "ちゃ|ちゅ|ちょ", kata: "チャ|チュ|チョ", romaji: ["cha", "chu", "cho"] },
  { kana: "にゃ|にゅ|にょ", kata: "ニャ|ニュ|ニョ", romaji: ["nya", "nyu", "nyo"] },
  { kana: "ひゃ|ひゅ|ひょ", kata: "ヒャ|ヒュ|ヒョ", romaji: ["hya", "hyu", "hyo"] },
  { kana: "みゃ|みゅ|みょ", kata: "ミャ|ミュ|ミョ", romaji: ["mya", "myu", "myo"] },
  { kana: "りゃ|りゅ|りょ", kata: "リャ|リュ|リョ", romaji: ["rya", "ryu", "ryo"] },
  { kana: "ぎゃ|ぎゅ|ぎょ", kata: "ギャ|ギュ|ギョ", romaji: ["gya", "gyu", "gyo"] },
  { kana: "じゃ|じゅ|じょ", kata: "ジャ|ジュ|ジョ", romaji: ["ja", "ju", "jo"] },
  { kana: "びゃ|びゅ|びょ", kata: "ビャ|ビュ|ビョ", romaji: ["bya", "byu", "byo"] },
  { kana: "ぴゃ|ぴゅ|ぴょ", kata: "ピャ|ピュ|ピョ", romaji: ["pya", "pyu", "pyo"] },
];

export const KANA_GROUPS = [
  { id: "seion", label: "清音", note: "46 音（含 ん）", rows: SEION_ROWS },
  { id: "dakuon", label: "浊音・半浊音", note: "25 音", rows: DAKUON_ROWS },
  { id: "yoon", label: "拗音", note: "33 音", rows: YOON_ROWS },
];

/** 把一行拆成单元：含 "|" 时按 "|" 拆，否则逐字符拆分 */
export function cellsOf(str) {
  return String(str).includes("|") ? String(str).split("|") : Array.from(String(str));
}

/** 一行的单元总数（用于计算表格列数，所有行应一致） */
export function rowWidth(row, script = "kana") {
  return cellsOf(row[script]).length;
}

/** 把一组行展开成 { kana, romaji } 数组 */
export function flattenGroup(group, script = "kana") {
  const cells = [];
  for (const row of group.rows) {
    const chars = cellsOf(row[script]);
    if (chars.length !== row.romaji.length) {
      console.warn(
        `kana-data 数据错位：${row.kana} 拆出 ${chars.length} 个单元，但罗马字有 ${row.romaji.length} 个`
      );
    }
    chars.forEach((ch, i) => {
      const romaji = row.romaji[i];
      if (romaji && ch.trim()) cells.push({ kana: ch, romaji });
    });
  }
  return cells;
}

/** 全部假名（用于测验） */
export function allKana(script = "kana") {
  return KANA_GROUPS.flatMap((g) => flattenGroup(g, script));
}

/** 一组所有行中的最大列数 */
export function maxWidth(group, script = "kana") {
  return Math.max(...group.rows.map((r) => rowWidth(r, script)));
}
