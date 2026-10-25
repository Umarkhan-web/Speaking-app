import React, { useState } from "react";
import { Icon3D } from "./Icon3D";
import { buzz } from "../utils/audio";

export const ONBOARDING_SLIDES = [
  {
    id: 1,
    tag: "AI Murabbiy",
    title: "IELTS Speaking sun’iy intellekt murabbiyi",
    desc: "Birdan! bilan istalgan vaqtda va istalgan mavzuda jonli inglizcha nutq mashqini bajaring. Hech qanday hayajonsiz, erkin va o'z tezligingizda gapiring.",
    webp: "/onboarding_1.webp",
    img: "/onboarding_1.png",
    fallbackIcon: "mic",
    accentColor: "var(--tang, #ff5722)",
    bgGradient: "linear-gradient(180deg, #93a9f7 0%, #b2e7fd 100%)",
  },
  {
    id: 2,
    tag: "Chuqur Tahlil",
    title: "Aktsent va xatolarni aniq tahlil qilish",
    desc: "Ilg'or Gemini AI nutqingizni tinglab, grammatik xatolarni o'zbek tilida tushuntiradi, Band 8.5+ model javob beradi va boy C1/C2 so'zlarni tavsiya qiladi.",
    webp: "/onboarding_2.webp",
    img: "/onboarding_2.png",
    fallbackIcon: "bulb",
    accentColor: "var(--cobalt, #2563eb)",
    bgGradient: "linear-gradient(180deg, #67a6e7 0%, #a5b4fc 100%)",
  },
  {
    id: 3,
    tag: "Tezkor Natija",
    title: "Kafolatlangan natija va doimiy o‘sish",
    desc: "Har kungi 15 daqiqalik mashq, kunlik streak, shaxsiy lug‘at daftarchasi va doimiy motivatsiya. Birinchi kundan boshlab erkin gapirishni boshlang!",
    webp: "/onboarding_3.webp",
    img: "/onboarding_3.png",
    fallbackIcon: "trophy",
    accentColor: "var(--butter, #f59e0b)",
    bgGradient: "linear-gradient(180deg, #7ab0ef 0%, #fde68a 100%)",
  },
];

export function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const [imgErrors, setImgErrors] = useState({});
  const [touchStartX, setTouchStartX] = useState(null);

  const isLast = current === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[current];

  const handleNext = () => {
    buzz(10, true);
    if (isLast) {
      if (onComplete) onComplete();
    } else {
      setCurrent((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (current > 0) {
      buzz(8, true);
      setCurrent((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    buzz(8, true);
    if (onComplete) onComplete();
  };

  const handleImgError = (idx) => {
    setImgErrors((prev) => ({ ...prev, [idx]: true }));
  };

  const onTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      setTouchStartX(e.touches[0].clientX);
    }
  };

  const onTouchEnd = (e) => {
    if (touchStartX === null) return;
    if (e.changedTouches && e.changedTouches.length > 0) {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (diff > 45) {
        // Swiped left -> next
        handleNext();
      } else if (diff < -45) {
        // Swiped right -> prev
        handlePrev();
      }
    }
    setTouchStartX(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "var(--bg)",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top Floating Header with Logo and Skip Pill */}
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 18px",
          background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.15) 60%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <div
          className="brand disp"
          style={{
            fontSize: "26px",
            lineHeight: 1,
            color: "#ffffff",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "baseline",
            textShadow: "0 2px 10px rgba(0, 0, 0, 0.45)",
            pointerEvents: "auto",
          }}
        >
          Birdan<i>!</i>
        </div>

        {!isLast && (
          <button
            type="button"
            onClick={handleSkip}
            style={{
              pointerEvents: "auto",
              background: "rgba(255, 255, 255, 0.88)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1.5px solid rgba(255, 255, 255, 0.7)",
              color: "#0f172a",
              fontSize: "13px",
              fontWeight: "800",
              cursor: "pointer",
              padding: "7px 15px",
              borderRadius: "999px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              transition: "transform 0.15s ease",
            }}
          >
            O‘tkazib yuborish
          </button>
        )}
      </header>

      {/* Main Expansive Visual Canvas (Full-bleed edge-to-edge top section) */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          flex: 1,
          width: "100%",
          position: "relative",
          overflow: "hidden",
          background: slide.bgGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!imgErrors[current] ? (
          <picture
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "block",
            }}
          >
            {slide.webp && <source srcSet={slide.webp} type="image/webp" />}
            <img
              key={slide.img}
              src={slide.img}
              alt={slide.title}
              onError={() => handleImgError(current)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 15%",
                display: "block",
                animation: "scr 0.35s ease-out",
              }}
            />
          </picture>
        ) : (
          /* Expansive 3D Graphic Canvas Fallback */
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              gap: "18px",
              animation: "scr 0.35s ease-out",
            }}
          >
            {/* Ambient Radial Glow */}
            <div
              style={{
                position: "absolute",
                width: "280px",
                height: "280px",
                borderRadius: "50%",
                background: slide.accentColor,
                opacity: 0.22,
                filter: "blur(60px)",
              }}
            />
            {/* Floating 3D Icon */}
            <div
              style={{
                transform: "scale(1.7)",
                filter: "drop-shadow(0 14px 24px rgba(0,0,0,0.2))",
              }}
            >
              <Icon3D name={slide.fallbackIcon} size={72} />
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#ffffff",
                background: "rgba(0, 0, 0, 0.35)",
                backdropFilter: "blur(8px)",
                padding: "6px 16px",
                borderRadius: "999px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
              }}
            >
              {slide.tag}
            </span>
          </div>
        )}

        {/* Soft bottom edge transition overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "70px",
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.2) 100%)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Bottom Content Sheet (Modern overlapping sheet like reference) */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          background: "var(--card)",
          borderTopLeftRadius: "32px",
          borderTopRightRadius: "32px",
          borderTop: "2.5px solid var(--edge)",
          boxShadow: "0 -10px 28px rgba(0, 0, 0, 0.12)",
          padding: "24px 22px 22px",
          marginTop: "-26px", // Overlaps bottom edge of image
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Category Pill Tag */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 14px",
              borderRadius: "999px",
              background: `${slide.accentColor}18`,
              border: `1.5px solid ${slide.accentColor}33`,
              color: slide.accentColor,
              fontSize: "12px",
              fontWeight: "800",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: slide.accentColor,
                display: "inline-block",
              }}
            />
            {slide.tag}
          </span>
        </div>

        {/* Title */}
        <h2
          className="disp"
          style={{
            fontSize: "22px",
            lineHeight: 1.25,
            textAlign: "center",
            margin: "0 0 8px 0",
            color: "var(--fg)",
            fontWeight: "900",
          }}
        >
          {slide.title}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: "14px",
            lineHeight: 1.48,
            textAlign: "center",
            margin: "0 0 16px 0",
            color: "var(--muted)",
            fontWeight: "500",
            minHeight: "42px",
          }}
        >
          {slide.desc}
        </p>

        {/* Pagination Dots Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            marginBottom: "18px",
          }}
        >
          {ONBOARDING_SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                buzz(6, true);
                setCurrent(idx);
              }}
              aria-label={`Slayd ${idx + 1}`}
              style={{
                border: "none",
                padding: 0,
                width: current === idx ? "26px" : "8px",
                height: "8px",
                borderRadius: "999px",
                background: current === idx ? slide.accentColor : "var(--edge)",
                opacity: current === idx ? 1 : 0.35,
                transition: "all 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          {!isLast ? (
            <>
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  flex: "1",
                  padding: "13px 10px",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  border: "2px solid var(--edge)",
                  borderRadius: "16px",
                  fontSize: "14.5px",
                  fontWeight: "800",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                O‘tkazish
              </button>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  flex: "1.6",
                  padding: "13px 16px",
                  background: slide.accentColor || "var(--tang, #ff5722)",
                  color: "#ffffff",
                  border: "2.5px solid var(--edge)",
                  borderRadius: "16px",
                  boxShadow: "0 4px 0 var(--edge)",
                  fontSize: "15px",
                  fontWeight: "900",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "transform 0.1s ease, box-shadow 0.1s ease",
                }}
              >
                <span>Keyingisi</span>
                <span style={{ fontSize: "16px" }}>➔</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              style={{
                width: "100%",
                padding: "15px",
                background: "var(--tang, #ff5722)",
                color: "#ffffff",
                border: "2.5px solid var(--edge)",
                borderRadius: "16px",
                boxShadow: "0 5px 0 var(--edge)",
                fontSize: "16px",
                fontWeight: "900",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                letterSpacing: "0.3px",
              }}
            >
              <span>Mashqni Boshlash</span>
              <span style={{ fontSize: "18px" }}>🚀</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
