import React, { useState } from "react";
import { hash } from "../utils/helpers";
import { buzz, beep } from "../utils/audio";
import { Icon3D } from "./Icon3D";

export function Profile({
  state,
  setState,
  onOpenMicTest,
  micStatus,
  onToast,
  user,
  onSignOut,
  onShowOnboarding,
}) {
  const [resetArmed, setResetArmed] = useState(false);
  const { p: profile } = state;

  const userInitial = (profile.name || user?.user_metadata?.full_name || user?.email || "B").charAt(0).toUpperCase();
  const avatarHue = hash(profile.name || user?.email || "birdan") % 360;
  const userAvatarUrl = user?.user_metadata?.avatar_url;

  const handleNameChange = (e) => {
    const val = e.target.value;
    setState((prev) => ({
      ...prev,
      p: { ...prev.p, name: val },
    }));
  };

  const handleGoalChange = (delta) => {
    buzz(8, profile.haptic);
    setState((prev) => ({
      ...prev,
      p: { ...prev.p, goal: Math.max(1, Math.min(5, (prev.p.goal || 1) + delta)) },
    }));
  };

  const handleToggle = (key) => {
    setState((prev) => {
      const nextVal = !prev.p[key];
      if (nextVal) {
        beep(600, 0.06, "square", 0.04, true);
        buzz(15, true);
      }
      return {
        ...prev,
        p: { ...prev.p, [key]: nextVal },
      };
    });
  };

  const handleSegmentChange = (key, val) => {
    buzz(8, profile.haptic);
    setState((prev) => ({
      ...prev,
      p: { ...prev.p, [key]: val },
    }));
  };

  const handleReset = () => {
    if (!resetArmed) {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 3500);
      return;
    }
    setState((prev) => ({
      ...prev,
      xp: 0,
      sessions: [],
      badges: {},
      vocab: [],
    }));
    setResetArmed(false);
    onToast("Barcha mashq ma’lumotlari tozalandi.");
  };

  return (
    <section className="screen on" aria-label="Profil">
      <h2 className="h2 disp" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Icon3D name="profile" size={32} />
        <span>Profil</span>
      </h2>

      {/* Avatar & Name */}
      <div className="avatar">
        {userAvatarUrl ? (
          <img
            src={userAvatarUrl}
            alt="Avatar"
            className="av"
            style={{ width: "54px", height: "54px", borderRadius: "50%", border: "2px solid var(--fg)" }}
          />
        ) : (
          <div
            className="av disp"
            style={{ background: `hsl(${avatarHue} 90% 68%)` }}
          >
            {userInitial}
          </div>
        )}
        <input
          type="text"
          maxLength={18}
          placeholder="Ismingiz"
          value={profile.name || user?.user_metadata?.full_name || ""}
          onChange={handleNameChange}
          aria-label="Ismingiz"
        />
      </div>

      {/* Shaxsiy Bulut Hisobi */}
      <div
        className="card"
        style={{
          margin: "14px 0",
          padding: "16px",
          background: user?.user_metadata?.is_guest
            ? "linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(239, 68, 68, 0.08))"
            : "linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(16, 185, 129, 0.08))",
          borderRadius: "16px",
          border: "2px solid var(--fg)",
          boxShadow: "3px 3px 0px var(--fg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.2rem" }}>{user?.user_metadata?.is_guest ? "👤" : "☁️"}</span>
            <b>{user?.user_metadata?.is_guest ? "Mehmon hisobi" : "Shaxsiy Bulut Hisobi"}</b>
          </div>
          <span
            style={{
              background: user?.user_metadata?.is_guest ? "#fef3c7" : "#dcfce7",
              color: user?.user_metadata?.is_guest ? "#92400e" : "#166534",
              fontSize: "0.75rem",
              fontWeight: "bold",
              padding: "3px 8px",
              borderRadius: "20px",
            }}
          >
            {user?.user_metadata?.is_guest ? "Mehmon" : "Faol"}
          </span>
        </div>
        <p style={{ margin: "4px 0 12px 0", fontSize: "0.85rem", opacity: 0.85 }}>
          {user?.user_metadata?.is_guest ? (
            <span>Natijalarni bulutda saqlash va sinxronlash uchun to‘liq akkaunt oching.</span>
          ) : (
            <span>Ulangan: <b>{user?.email}</b></span>
          )}
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          {user?.user_metadata?.is_guest ? (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                padding: "8px 14px",
                background: "var(--tang, #ff5722)",
                color: "#fff",
                border: "1.5px solid var(--fg)",
                borderRadius: "8px",
                fontSize: "0.84rem",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Akkaunt ochish 🚀
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignOut}
              style={{
                padding: "8px 14px",
                background: "#fff",
                color: "#111",
                border: "1.5px solid #111",
                borderRadius: "8px",
                fontSize: "0.84rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Chiqish
            </button>
          )}
        </div>
      </div>

      {/* Daily Goal */}
      <div className="row">
        <div>
          <b>Kunlik maqsad</b>
          <small>Kuniga nechta mashq bajarmoqchisiz</small>
        </div>
        <div className="step">
          <button onClick={() => handleGoalChange(-1)} aria-label="Kamaytirish">
            –
          </button>
          <span>{profile.goal || 1}</span>
          <button onClick={() => handleGoalChange(1)} aria-label="Ko‘paytirish">
            +
          </button>
        </div>
      </div>

      {/* AI Language */}
      <div className="row">
        <div>
          <b>AI izohlari tili</b>
          <small>Xato va maslahatlar tushuntirishi</small>
        </div>
        <div className="seg sm">
          {[
            ["uz", "O‘zbek"],
            ["en", "English"],
          ].map(([val, label]) => (
            <button
              key={val}
              aria-pressed={profile.expl === val}
              onClick={() => handleSegmentChange("expl", val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pronunciation Accent */}
      <div className="row">
        <div>
          <b>Talaffuz turi</b>
          <small>Ovozli o‘qish talaffuzi</small>
        </div>
        <div className="seg sm">
          {[
            ["en-US", "US"],
            ["en-GB", "UK"],
          ].map(([val, label]) => (
            <button
              key={val}
              aria-pressed={profile.lang === val}
              onClick={() => handleSegmentChange("lang", val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Microphone status and test */}
      <div className="row">
        <div>
          <b>Mikrofon holati</b>
          <small>
            {micStatus === "granted"
              ? "Mikrofon ruxsati berilgan"
              : micStatus === "denied"
              ? "Mikrofon bloklangan"
              : "Tekshirilmagan"}
          </small>
        </div>
        <button className="mbtn" onClick={onOpenMicTest}>
          Sinash
        </button>
      </div>

      {/* Phrase hints toggle */}
      <div className="row">
        <div>
          <b>Gap shablonlari</b>
          <small>Mashq paytida ko‘makchi iboralar</small>
        </div>
        <button
          className="sw"
          role="switch"
          aria-checked={profile.help}
          onClick={() => handleToggle("help")}
        >
          <span className="knob" />
        </button>
      </div>

      {/* Sound toggle */}
      <div className="row">
        <div>
          <b>Ovoz effektlari</b>
          <small>Taymer va tugatish tovushlari</small>
        </div>
        <button
          className="sw"
          role="switch"
          aria-checked={profile.sound}
          onClick={() => handleToggle("sound")}
        >
          <span className="knob" />
        </button>
      </div>

      {/* Haptic toggle */}
      <div className="row">
        <div>
          <b>Tebranish (Haptic)</b>
          <small>Tugma va vaqt signallarida tebranish</small>
        </div>
        <button
          className="sw"
          role="switch"
          aria-checked={profile.haptic}
          onClick={() => handleToggle("haptic")}
        >
          <span className="knob" />
        </button>
      </div>

      {/* Theme toggle */}
      <div className="row">
        <div>
          <b>Ko‘rinish mavzusi</b>
          <small>Och yoki to‘q rang rejimi</small>
        </div>
        <div className="seg sm">
          {[
            ["auto", "Avto"],
            ["light", "Och"],
            ["dark", "To‘q"],
          ].map(([val, label]) => (
            <button
              key={val}
              aria-pressed={profile.theme === val}
              onClick={() => handleSegmentChange("theme", val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Onboarding preview button */}
      <div className="row">
        <div>
          <b>Ilova tanishuvi (Preview)</b>
          <small>Kirish slaydlari va imkoniyatlarni ko‘rish</small>
        </div>
        <button
          type="button"
          className="mbtn"
          onClick={onShowOnboarding}
          style={{ padding: "6px 14px", fontWeight: "700" }}
        >
          Ko‘rish
        </button>
      </div>

      {/* Reset button */}
      <button
        className={`danger ${resetArmed ? "arm" : ""}`}
        onClick={handleReset}
      >
        {resetArmed ? "Aniqmi? Yana bir marta bosing" : "Barcha ma’lumotni tozalash"}
      </button>

      <p className="foot">
        Ma’lumotlar qurilmangizda saqlanadi. Audio tahlili mahalliy Whisper va Ollama orqali xavfsiz amalga oshiriladi.
      </p>
    </section>
  );
}
