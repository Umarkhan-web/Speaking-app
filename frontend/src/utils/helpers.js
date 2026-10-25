import { STOP_WORDS, LEVELS } from "../data/constants";

export const dkey = (d = new Date()) => {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function fmt(s) {
  const t = Math.round(s || 0);
  const m = Math.floor(t / 60);
  return m + ":" + String(t % 60).padStart(2, "0");
}

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function textStats(text, sec) {
  const words = (
    (text || "")
      .toLowerCase()
      .match(/[a-z’']+/g) || []
  ).map((x) => x.replace(/’/g, "'"));
  const n = words.length;
  const uniq = n ? Math.round((new Set(words).size / n) * 100) : 0;
  const cnt = {};
  words.forEach((x) => {
    if (x.length > 3 && !STOP_WORDS.has(x)) {
      cnt[x] = (cnt[x] || 0) + 1;
    }
  });
  const rep = Object.keys(cnt)
    .filter((k) => cnt[k] >= 3)
    .sort((a, b) => cnt[b] - cnt[a])
    .slice(0, 3)
    .map((k) => k + " ×" + cnt[k]);

  const fillerRegex = /\b(?:um+|uh+|erm*|hmm+|you know|i mean|basically|actually|literally)\b/gi;
  const fill = (text.match(fillerRegex) || []).length;

  return {
    n,
    uniq,
    rep,
    fill,
    wpm: sec >= 5 && n ? Math.round(n / (sec / 60)) : null,
  };
}

export function lvlInfo(xp = 0) {
  const l = Math.min(7, Math.floor(Math.sqrt(xp / 60)) + 1);
  const lo = 60 * (l - 1) * (l - 1);
  const hi = 60 * l * l;
  return {
    l,
    name: LEVELS[l - 1] || "Notiq",
    pct: l === 7 ? 1 : (xp - lo) / (hi - lo),
    need: l === 7 ? 0 : hi - xp,
  };
}

export function getDaysSet(sessions = []) {
  const s = {};
  sessions.forEach((x) => {
    s[x.day] = (s[x.day] || 0) + 1;
  });
  return s;
}

export function streak(sessions = []) {
  const set = getDaysSet(sessions);
  const d = new Date();
  if (!set[dkey(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set[dkey(d)]) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function bestStreak(sessions = []) {
  const set = getDaysSet(sessions);
  const days = Object.keys(set).sort();
  let best = 0;
  let cur = 0;
  let prev = null;
  days.forEach((k) => {
    const p = k.split("-").map(Number);
    const t = Date.UTC(p[0], p[1] - 1, p[2]) / 86400000;
    cur = prev !== null && t - prev === 1 ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = t;
  });
  return best;
}
