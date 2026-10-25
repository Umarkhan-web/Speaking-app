import React from "react";

// Maxsus 3D iconlar - frontend/public/icons3d papkasida mahalliy saqlangan (0ms kechikish, 100% ishonchli)
export const ICONS3D = {
  mic: "/icons3d/mic.png",
  book: "/icons3d/book.png",
  trophy: "/icons3d/trophy.png",
  profile: "/icons3d/profile.png",
  fire: "/icons3d/fire.png",
  rocket: "/icons3d/rocket.png",
  dice: "/icons3d/dice.png",
  bulb: "/icons3d/bulb.png",
  memo: "/icons3d/memo.png",
  target: "/icons3d/target.png",
  crown: "/icons3d/crown.png",
  check: "/icons3d/check.png",
  star: "/icons3d/star.png",
  wave: "/icons3d/wave.png",
  chart: "/icons3d/chart.png",
  sparkle: "/icons3d/sparkle.png",
  party: "/icons3d/party.png",
  gem: "/icons3d/gem.png",
  cross: "/icons3d/cross.png",
  speaker: "/icons3d/speaker.png",
  calendar: "/icons3d/calendar.png",
  headphone: "/icons3d/headphone.png",
  medal: "/icons3d/medal.png",
  clock: "/icons3d/clock.png",
  puzzle: "/icons3d/puzzle.png",
  coin: "/icons3d/coin.png",
};

export function Icon3D({ name, size = 24, className = "", style = {}, alt = "" }) {
  const src = ICONS3D[name] || ICONS3D.sparkle;

  return (
    <img
      src={src}
      alt={alt || name}
      width={size}
      height={size}
      className={`icon-3d ${className}`}
      loading="eager"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        objectFit: "contain",
        filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.18))",
        userSelect: "none",
        pointerEvents: "none",
        transition: "transform 0.15s ease",
        ...style,
      }}
    />
  );
}
