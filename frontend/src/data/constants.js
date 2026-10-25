export const CATS = {
  daily: "Kundalik hayot",
  work: "Ish va o‘qish",
  travel: "Sayohat",
  tech: "Texnologiya",
  opinion: "Fikr bildirish",
  story: "Hikoya",
  custom: "O‘zim tanladim"
};

export const LVC = {
  1: "A2",
  2: "B1",
  3: "B2"
};

export const LVN = {
  1: "Boshlang‘ich",
  2: "O‘rta",
  3: "Yuqori"
};

export const LEVELS = [
  "Jim",
  "Pichirlovchi",
  "Gapga chechan",
  "Gapdon",
  "Notiq",
  "Sahna yulduzi",
  "Afsona"
];

export const MODES = {
  short: { n: "Qisqa", s: "15 s + 30 s", think: 15, speak: 30, xp: 15 },
  std: { n: "Standart", s: "30 s + 1 daq", think: 30, speak: 60, xp: 30 },
  long: { n: "Uzun", s: "45 s + 2 daq", think: 45, speak: 120, xp: 55 }
};

export const PHRASES = [
  ["Boshlash", [
    ["Today I’d like to talk about…", "Bugun … haqida gapirmoqchiman"],
    ["Let me start by saying…", "Avval shuni aytay…"]
  ]],
  ["Davom", [
    ["Another thing is that…", "Yana bir narsa…"],
    ["For example,…", "Masalan,…"],
    ["What’s more,…", "Bundan tashqari,…"]
  ]],
  ["Fikr", [
    ["In my opinion,…", "Mening fikrimcha,…"],
    ["The reason is that…", "Sababi shundaki…"]
  ]],
  ["Hikoya", [
    ["I still remember…", "Hali ham esimda…"],
    ["After that,…", "Shundan keyin…"]
  ]],
  ["Yakun", [
    ["To sum up,…", "Xulosa qilib aytganda,…"],
    ["That’s why I think…", "Shuning uchun men o‘ylaymanki…"]
  ]]
];

export const BADGES = [
  { id: "first", n: "Birinchi qadam", e: "🎤", icon3d: "mic", t: (s) => s.sessions.length >= 1 },
  { id: "ten", n: "O‘nlik", e: "🔟", icon3d: "target", t: (s) => s.sessions.length >= 10 },
  { id: "s3", n: "3 kun ketma-ket", e: "🔥", icon3d: "fire", t: (s, bestStreak) => bestStreak >= 3 },
  { id: "s7", n: "Haftalik olov", e: "🚀", icon3d: "rocket", t: (s, bestStreak) => bestStreak >= 7 },
  { id: "fluency", n: "Zo‘r ravonlik", e: "🗣️", icon3d: "sparkle", t: (s) => s.sessions.some(x => x.analysis && x.analysis.fluency_score >= 8) },
  { id: "gram", n: "Toza grammatika", e: "✅", icon3d: "check", t: (s) => s.sessions.some(x => x.analysis && (!x.analysis.grammar_errors || x.analysis.grammar_errors.length === 0)) },
  { id: "vocab", n: "20 ta yangi so‘z", e: "📚", icon3d: "book", t: (s) => (s.vocab || []).length >= 20 },
  { id: "b1", n: "B2 darajasi", e: "🏅", icon3d: "medal", t: (s) => s.sessions.some(x => x.analysis && ["B2", "C1", "C2"].includes(x.analysis.vocabulary_level)) }
];

export const DAILY_TIPS = [
  "Gapni boshlashdan oldin 3 soniya nafas oling. Shoshilish xatoni ko‘paytiradi.",
  "Bitta aniq misol o‘nta umumiy gapdan kuchliroq.",
  "Bilmagan so‘zingiz chiqsa to‘xtamang, boshqa so‘z bilan tushuntiring.",
  "Har kuni 1 daqiqa, haftada bir marta 10 daqiqadan foydaliroq.",
  "Tahlildan keyin tuzatilgan variantni baland ovozda qayta ayting.",
  "Ravonlik tezlikdan emas, uzluksizlikdan keladi. Sekinroq gapiring.",
  "Mavzuni o‘z hayotingizdagi voqea bilan bog‘lang. Hikoya so‘z topishni osonlashtiradi."
];

export const STOP_WORDS = new Set(
  "the a an and i to of is it in that was for on are with as my you we they he she but so be have at this not or me do can very just because like am were been has had will would there their what which when your our them his her its if from by about more also".split(" ")
);
