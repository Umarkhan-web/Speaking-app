import React, { useState } from "react";
import { CATS, LVC, LVN, MODES } from "../data/constants";
import { TOPICS } from "../data/topics";
import { dkey, hash, streak, getDaysSet, lvlInfo } from "../utils/helpers";
import { buzz } from "../utils/audio";
import { generateAITopic } from "../services/api";
import { Icon3D } from "./Icon3D";

// Short concise labels to prevent categories from taking up excessive screen space
const CAT_LABELS = {
  today: "Bugungi",
  all: "Barchasi",
  daily: "Kundalik",
  work: "Ish/Ta'lim",
  travel: "Sayohat",
  tech: "Texno",
  opinion: "Fikr",
  story: "Hikoya",
};

export function Home({
  state,
  setState,
  topics = [],
  onStartSession,
  onOpenMicTest,
  micStatus,
  user,
  onOpenAuth,
  onNavigateTab,
}) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  const { p: profile, xp, sessions } = state;
  const currentStreak = streak(sessions);
  const currentLevelInfo = lvlInfo(xp);

  // Active pool from background loaded topics or static topics fallback
  const activePool = topics && topics.length > 0 ? topics : TOPICS;

  const dailyTopic = () => {
    const pool = activePool.filter((t) => t.lvl === profile.level);
    if (!pool.length) return activePool[0] || TOPICS[0];
    return pool[hash("birdan" + dkey() + profile.level) % pool.length];
  };

  const getFilteredTopics = () => {
    let pool = activePool.filter((t) => t.lvl === profile.level);
    if (profile.cat !== "all" && profile.cat !== "today") {
      const q = pool.filter((t) => t.cat === profile.cat);
      if (q.length) pool = q;
    }
    return pool.length ? pool : TOPICS.filter((t) => t.lvl === profile.level);
  };

  const currentTopic = state.currentTopic || dailyTopic();

  const handleShuffle = () => {
    buzz(10, profile.haptic);
    setIsFlipping(true);
    setCustomMode(false);
    setTimeout(() => {
      const pool = profile.cat === "today" ? [dailyTopic()] : getFilteredTopics();
      let nextTopic = pool[Math.floor(Math.random() * pool.length)];
      if (pool.length > 1 && nextTopic.en === currentTopic.en) {
        nextTopic = pool.find((t) => t.en !== currentTopic.en) || nextTopic;
      }
      setState((prev) => ({ ...prev, currentTopic: nextTopic }));
      setIsFlipping(false);
    }, 180);
  };

  const handleSelectLevel = (lvl) => {
    buzz(8, profile.haptic);
    setState((prev) => {
      const updatedProfile = { ...prev.p, level: lvl };
      const pool = activePool.filter((t) => t.lvl === lvl);
      const nextTopic = pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : TOPICS[0];
      return { ...prev, p: updatedProfile, currentTopic: nextTopic };
    });
  };

  const handleSelectCategory = (cat) => {
    buzz(8, profile.haptic);
    setCustomMode(false);
    setState((prev) => {
      const updatedProfile = { ...prev.p, cat };
      let pool = activePool.filter((t) => t.lvl === prev.p.level);
      if (cat === "today") {
        pool = [dailyTopic()];
      } else if (cat !== "all") {
        const q = pool.filter((t) => t.cat === cat);
        if (q.length) pool = q;
      }
      const nextTopic = pool[Math.floor(Math.random() * pool.length)] || activePool[0];
      return { ...prev, p: updatedProfile, currentTopic: nextTopic };
    });
  };

  const handleSelectMode = (modeKey) => {
    buzz(8, profile.haptic);
    setState((prev) => ({
      ...prev,
      p: { ...prev.p, mode: modeKey },
    }));
  };

  const handleCustomSubmit = async () => {
    if (customInput.trim().length < 2) return;
    buzz(10, profile.haptic);
    setIsSubmittingCustom(true);
    try {
      const generated = await generateAITopic(customInput.trim(), profile.level);
      if (generated && generated.q) {
        setState((prev) => ({ ...prev, currentTopic: generated }));
        setCustomMode(false);
        setCustomInput("");
        setIsSubmittingCustom(false);
        return;
      }
    } catch {}

    const customTopic = {
      en: customInput.trim(),
      uz: "Sizning shaxsiy mavzuingiz",
      cat: "custom",
      lvl: profile.level,
      hint: "Mavzu bo‘yicha fikrlaringizni tartibli va batafsil bayon qiling.",
      q: [
        `What is it about, and why is it interesting to you?`,
        `What are the most important details or examples of this?`,
        `How do you think this will change or develop in the future?`,
      ],
      custom: true,
    };
    setState((prev) => ({ ...prev, currentTopic: customTopic }));
    setCustomMode(false);
    setCustomInput("");
    setIsSubmittingCustom(false);
  };

  // Week days calculation
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const daysSet = getDaysSet(sessions);
  const weekDays = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

  // Greeting
  const hour = now.getHours();
  const greeting = hour < 12 ? "Xayrli tong" : hour < 18 ? "Xayrli kun" : "Xayrli kech";

  // Today goal
  const todaySessions = sessions.filter((s) => s.day === dkey()).length;
  const goalTarget = profile.goal || 1;

  return (
    <section className="screen on" aria-label="Mashq">
      {/* Header */}
      <header className="top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div className="brand disp">
          Birdan<i>!</i>
        </div>
        <div className="chips">
          <div className="chip" title="Ketma-ket mashq kunlari" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Icon3D name="fire" size={17} />
            <b>{currentStreak} kun</b>
          </div>
          <div className="chip lv" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Icon3D name="crown" size={16} />
            <span>Lv {currentLevelInfo.l}</span>
          </div>
          <button
            type="button"
            className="chip user-chip"
            onClick={() => onNavigateTab && onNavigateTab("me")}
            title="Profil sozlamalari"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              border: "2px solid var(--edge)",
              background: "var(--card)",
              padding: "0 8px",
              height: "30px",
              maxWidth: "105px",
            }}
          >
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                style={{ width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0 }}
              />
            ) : (
              <span style={{ fontSize: "13px" }}>👤</span>
            )}
            <b
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "12px",
              }}
            >
              {user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Profil"}
            </b>
          </button>
        </div>
      </header>

      {/* Greeting */}
      <h1 className="hello disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon3D name="wave" size={30} />
        <span>
          {greeting}, {user?.user_metadata?.full_name?.split(" ")[0] || profile.name || user?.email?.split("@")[0] || "notiq"}!
        </span>
      </h1>

      {/* Level Selection */}
      <div className="seg" role="group" aria-label="Daraja">
        {[1, 2, 3].map((lvl) => (
          <button
            key={lvl}
            aria-pressed={profile.level === lvl}
            onClick={() => handleSelectLevel(lvl)}
          >
            <b>{LVC[lvl]}</b>
            <small>{LVN[lvl]}</small>
          </button>
        ))}
      </div>

      {/* Compact Categories Bar (No horizontal scroll, takes minimal space) */}
      <div className="cats" role="group" aria-label="Turkum">
        {[
          ["today", CAT_LABELS.today],
          ["all", CAT_LABELS.all],
          ...Object.keys(CATS)
            .filter((k) => k !== "custom")
            .map((k) => [k, CAT_LABELS[k] || CATS[k]]),
        ].map(([catKey, label]) => (
          <button
            key={catKey}
            aria-pressed={profile.cat === catKey}
            onClick={() => handleSelectCategory(catKey)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Topic Card Deck */}
      <div className="deck">
        <article className={`cue ${isFlipping ? "out" : "in"}`}>
          {customMode ? (
            <div>
              <div className="cue-top">
                <span className="stk c3">O‘z mavzum</span>
              </div>
              <h2 className="cue-h disp" style={{ fontSize: "28px" }}>
                Nima haqida gapirasiz?
              </h2>
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                maxLength={100}
                placeholder="Inglizcha yoki o‘zbekcha mavzu, masalan: My dream job"
                aria-label="Mavzu"
                disabled={isSubmittingCustom}
              />
              <button
                className="okbtn"
                onClick={handleCustomSubmit}
                disabled={isSubmittingCustom || customInput.trim().length < 2}
              >
                {isSubmittingCustom ? "Tayyorlanmoqda..." : "Mavzuni tanlash"}
              </button>
            </div>
          ) : (
            <div>
              <div className="cue-top">
                <span className="stk c1">{CATS[currentTopic.cat] || "Mavzu"}</span>
                <span className="stk c2">
                  {LVC[currentTopic.lvl]} {LVN[currentTopic.lvl]}
                </span>
                {profile.cat === "today" && (
                  <span className="stk c3">Bugungi mavzu</span>
                )}
              </div>

              <h2 className="cue-h disp">{currentTopic.en}</h2>
              <p className="cue-uz">{currentTopic.uz}</p>
              <p className="cue-hint">{currentTopic.hint}</p>

              <ul className="cue-q">
                {currentTopic.q?.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>

      {/* Cue Action Buttons (Only 2 original buttons, no extra AI button) */}
      <div className="cuebtns">
        <button
          onClick={handleShuffle}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <Icon3D name="dice" size={20} />
          Boshqa mavzu
        </button>

        <button
          onClick={() => {
            buzz(8, profile.haptic);
            setCustomMode(!customMode);
          }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <Icon3D name="memo" size={20} />
          {customMode ? "Mavzularga qaytish" : "O‘z mavzum"}
        </button>
      </div>

      {/* Duration Mode Selection (Vaqt rejimini tanlash) */}
      <div style={{ marginTop: "14px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Icon3D name="clock" size={18} />
          <span>Gapirish davomiyligi:</span>
        </div>
        <div className="seg" role="group" aria-label="Vaqt" style={{ margin: 0 }}>
          {Object.entries(MODES).map(([key, val]) => (
            <button
              key={key}
              aria-pressed={profile.mode === key}
              onClick={() => handleSelectMode(key)}
            >
              <b>{val.n}</b>
              <small>{val.s}</small>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Action Button (Katta boshlash tugmasi) */}
      <div className="cta" style={{ marginTop: "14px" }}>
        <button
          className="btn go"
          onClick={() => onStartSession(currentTopic)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          <Icon3D name="rocket" size={26} />
          Gapirishni boshlash
        </button>
      </div>

      {/* Gamified 3D Streak & Weekly Tracker */}
      <div className="streak-card">
        <div className="streak-card-top">
          <div className="streak-title-wrap">
            <Icon3D name="fire" size={32} />
            <div>
              <h3>Haftalik Mashq</h3>
              <p>
                {currentStreak > 0
                  ? `🔥 ${currentStreak} kunlik ketma-ketlik davom etmoqda!`
                  : "Bugungi ilk mashqni boshlang!"}
              </p>
            </div>
          </div>
          <div className="streak-badge">
            <Icon3D name={todaySessions >= goalTarget ? "check" : "target"} size={16} />
            <span>{todaySessions >= goalTarget ? "Bajarildi" : `${todaySessions}/${goalTarget}`}</span>
          </div>
        </div>

        {/* 7 Day Capsules */}
        <div className="streak-days">
          {weekDays.map((dayLabel, i) => {
            const d = new Date(now);
            d.setDate(now.getDate() - dow + i);
            const done = !!daysSet[dkey(d)];
            const isToday = i === dow;
            return (
              <div
                key={dayLabel}
                className={`streak-day-capsule ${done ? "done" : isToday ? "today" : ""}`}
              >
                <span className="streak-day-name">{dayLabel}</span>
                <div className="streak-day-icon-wrap">
                  {done ? (
                    <Icon3D name="check" size={16} />
                  ) : isToday ? (
                    <Icon3D name="target" size={16} />
                  ) : (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ccd2e8" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Weekly Progress bar */}
        <div className="streak-progress-box">
          <span>Haftalik natija:</span>
          <div className="streak-bar-bg">
            <div
              className="streak-bar-fill"
              style={{
                width: `${Math.round(
                  (weekDays.filter((_, i) => {
                    const d = new Date(now);
                    d.setDate(now.getDate() - dow + i);
                    return !!daysSet[dkey(d)];
                  }).length / 7) * 100
                )}%`,
              }}
            />
          </div>
          <span style={{ fontWeight: 800 }}>
            {weekDays.filter((_, i) => {
              const d = new Date(now);
              d.setDate(now.getDate() - dow + i);
              return !!daysSet[dkey(d)];
            }).length} / 7 kun
          </span>
        </div>
      </div>
    </section>
  );
}
