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
      {/* Compact Header */}
      <header className="top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
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

      {/* Level Selection */}
      <div className="seg" role="group" aria-label="Daraja" style={{ marginBottom: "10px" }}>
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
                  <span className="stk c3">Bugungi</span>
                )}
              </div>

              <h2 className="cue-h disp">{currentTopic.en}</h2>
              <p className="cue-uz">{currentTopic.uz}</p>

              {currentTopic.q && currentTopic.q.length > 0 && (
                <ul className="cue-q">
                  {currentTopic.q.slice(0, 2).map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </article>
      </div>

      {/* Cue Action Buttons */}
      <div className="cuebtns" style={{ marginTop: "10px" }}>
        <button
          onClick={handleShuffle}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <Icon3D name="dice" size={18} />
          Boshqa mavzu
        </button>

        <button
          onClick={() => {
            buzz(8, profile.haptic);
            setCustomMode(!customMode);
          }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
        >
          <Icon3D name="memo" size={18} />
          {customMode ? "Orqaga" : "O‘z mavzum"}
        </button>
      </div>

      {/* Duration Mode Selection */}
      <div className="seg" role="group" aria-label="Vaqt" style={{ marginTop: "12px", marginBottom: "8px" }}>
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

      {/* Primary Action Button - Sticky CTA */}
      <div className="cta">
        <button
          className="btn go"
          onClick={() => onStartSession(currentTopic)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          <Icon3D name="rocket" size={26} />
          Gapirishni boshlash
        </button>
      </div>
    </section>
  );
}
