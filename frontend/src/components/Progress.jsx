import React from "react";
import { BADGES } from "../data/constants";
import { lvlInfo, bestStreak, getDaysSet, dkey, fmt } from "../utils/helpers";
import { Icon3D } from "./Icon3D";

const SKILL_ITEMS = [
  { key: "pronunciation", label: "Talaffuz", color: "var(--pink)" },
  { key: "grammar", label: "Grammatika", color: "var(--cobalt)" },
  { key: "vocabulary", label: "Lug‘at boyligi", color: "var(--mint)" },
  { key: "fluency", label: "Ravonlik", color: "var(--tang)" },
  { key: "content", label: "Mazmun", color: "var(--butter)" },
];

export function Progress({ state }) {
  const { xp, sessions, badges } = state;
  const totalSessions = sessions.length;
  const totalMinutes = Math.round(
    sessions.reduce((acc, curr) => acc + (curr.speak || 0), 0) / 60
  );

  const wpmValues = sessions.filter((s) => s.wpm).map((s) => s.wpm);
  const avgWpm = wpmValues.length
    ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length)
    : "–";

  const userBestStreak = bestStreak(sessions);
  const currentLevel = lvlInfo(xp);

  // 28 days heatmap
  const daysSet = getDaysSet(sessions);
  const now = new Date();
  const heatmapDays = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = dkey(d);
    const count = daysSet[key] || 0;
    heatmapDays.push({
      key,
      count,
      isToday: i === 0,
      levelClass: count ? `l${Math.min(3, count)}` : "",
    });
  }

  // Skills from AI analyses
  const sessionsWithAI = sessions.filter((s) => s.analysis);
  const last10AI = sessionsWithAI.slice(-10);

  // Calculate average scores per skill
  const skillScores = SKILL_ITEMS.map((item) => {
    let scoreVal = null;
    if (sessionsWithAI.length > 0) {
      if (item.key === "fluency") {
        // Fluency score is 1-10 in analyzer, convert to 0-100
        const vals = sessionsWithAI
          .map((s) => s.analysis.fluency_score)
          .filter((v) => v != null);
        if (vals.length) {
          scoreVal = Math.round(
            (vals.reduce((a, b) => a + b, 0) / vals.length) * 10
          );
        }
      } else if (item.key === "grammar") {
        const errorCounts = sessionsWithAI.map(
          (s) => s.analysis.grammar_errors?.length || 0
        );
        const avgErrors =
          errorCounts.reduce((a, b) => a + b, 0) / errorCounts.length;
        scoreVal = Math.max(20, Math.round(100 - avgErrors * 15));
      } else if (item.key === "vocabulary") {
        // Map A1..C2 to numeric score
        const levelMap = { A1: 40, A2: 55, B1: 70, B2: 85, C1: 95, C2: 100 };
        const vals = sessionsWithAI
          .map((s) => levelMap[s.analysis.vocabulary_level] || 60);
        scoreVal = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      } else {
        scoreVal = 75; // default estimation
      }
    }
    return { ...item, score: scoreVal };
  });

  const recentSessions = sessions.slice(-6).reverse();

  return (
    <section className="screen on" aria-label="Natijalar">
      <h2 className="h2 disp" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Icon3D name="trophy" size={32} />
        <span>Natijalaringiz</span>
      </h2>

      {/* Main Board */}
      <div className="board">
        <div>
          <b>{totalSessions}</b>
          <span>mashq</span>
        </div>
        <div>
          <b>{totalMinutes}</b>
          <span>daqiqa gapirdingiz</span>
        </div>
        <div>
          <b>{avgWpm}</b>
          <span>o‘rtacha so‘z/daq</span>
        </div>
        <div>
          <b>{userBestStreak}</b>
          <span>eng uzun seriya (kun)</span>
        </div>
      </div>

      {/* Level XP Bar */}
      <div className="lvl">
        <div className="lr">
          <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Icon3D name="crown" size={24} />
            <span>{currentLevel.name}</span>
          </h3>
          <small>
            {currentLevel.need
              ? `keyingi darajagacha ${currentLevel.need} XP`
              : "Eng yuqori daraja"}
          </small>
        </div>
        <div className="xpbar">
          <i style={{ width: `${Math.round(currentLevel.pct * 100)}%` }} />
        </div>
      </div>

      {/* Skills */}
      <h3 className="sec disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon3D name="chart" size={22} />
        <span>Ko‘nikmalar</span>
      </h3>
      {sessionsWithAI.length > 0 ? (
        <>
          <div className="sk">
            {skillScores.map((s) => (
              <div className="skr" key={s.key}>
                <span>{s.label}</span>
                <div className="skt">
                  <i
                    style={{
                      width: `${s.score || 0}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <em>{s.score != null ? s.score : "–"}</em>
              </div>
            ))}
          </div>

          {last10AI.length > 0 && (
            <>
              <h3 className="sec disp" style={{ marginTop: "24px" }}>
                Ravonlik dinamikasi
              </h3>
              <div className="bars">
                {last10AI.map((s, idx) => {
                  const sc = (s.analysis.fluency_score || 5) * 10;
                  return (
                    <div key={idx}>
                      <span>{sc}</span>
                      <i style={{ height: `${Math.max(6, sc * 0.9)}px` }} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <p className="empty">
          AI tahlil qilingan mashqlardan keyin ko‘nikmalaringiz shu yerda hisoblanadi.
        </p>
      )}

      {/* 28 Day Heatmap */}
      <h3 className="sec disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon3D name="calendar" size={22} />
        <span>Oxirgi 28 kun</span>
      </h3>
      <div className="heat">
        {heatmapDays.map((d) => (
          <i
            key={d.key}
            className={`${d.levelClass} ${d.isToday ? "today" : ""}`}
            title={d.key}
          >
            {d.count || ""}
          </i>
        ))}
      </div>

      {/* Medals */}
      <h3 className="sec disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon3D name="gem" size={22} />
        <span>Medallar</span>
      </h3>
      <div className="medals">
        {BADGES.map((b) => {
          const unlocked = !!badges[b.id];
          return (
            <div className={`medal ${unlocked ? "" : "lk"}`} key={b.id} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon3D name={b.icon3d || "medal"} size={26} />
              <span>{b.n}</span>
            </div>
          );
        })}
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <>
          <h3 className="sec disp">So‘nggi mashqlar</h3>
          <ul className="recent">
            {recentSessions.map((s, i) => (
              <li key={i}>
                <b>{s.topic}</b>
                <span>
                  {fmt(s.speak)}
                  {s.analysis?.estimated_ielts_band
                    ? `, Band: ${s.analysis.estimated_ielts_band}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
