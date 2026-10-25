import React, { useEffect, useRef, useState, useCallback } from "react";
import { getAudioContext } from "../utils/audio";

export function MicTestModal({ isOpen, onClose, onCheckPermission, micStatus }) {
  const [level, setLevel] = useState(0);
  const streamRef = useRef(null);
  const animRef = useRef(null);

  const cleanup = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startMeter = useCallback(async () => {
    cleanup();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = getAudioContext();
      if (!ctx) return;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        setLevel(avg);
        animRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) {
      console.warn("Mic test error:", e);
    }
  }, [cleanup]);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    if (micStatus === "granted") {
      startMeter();
    }

    return () => cleanup();
  }, [isOpen, micStatus, cleanup, startMeter]);

  if (!isOpen) return null;

  const getAdvice = () => {
    switch (micStatus) {
      case "granted":
        return "Mikrofon ishlayapti! Biror narsa deng, pastdagi chiziqlar harakatlanishi kerak.";
      case "denied":
        return "Mikrofonga ruxsat berilmagan. Brauzer manzil qatoridagi qulf belgisini bosib, Mikrofonga ruxsat bering.";
      default:
        return "Tugmani bosing va brauzer so'raganda “Ruxsat berish” (Allow) ni tanlang.";
    }
  };

  return (
    <div id="modal" onClick={(e) => e.target.id === "modal" && onClose()}>
      <div className="msheet" role="dialog" aria-label="Mikrofon">
        <h3 className="disp">Mikrofonni sinash</h3>
        <p>{getAdvice()}</p>

        {micStatus === "granted" && (
          <div className="meter">
            {Array.from({ length: 16 }).map((_, i) => {
              const heightFactor = Math.max(
                0.08,
                Math.min(1, level * 2.2 * (0.6 + Math.sin(i * 0.4) * 0.4))
              );
              return (
                <i
                  key={i}
                  style={{
                    transform: `scaleY(${heightFactor.toFixed(2)})`,
                    transformOrigin: "bottom",
                  }}
                />
              );
            })}
          </div>
        )}

        <div className="mbtns">
          <button onClick={onClose}>Yopish</button>
          <button
            className="pri"
            onClick={async () => {
              await onCheckPermission();
              startMeter();
            }}
          >
            {micStatus === "granted" ? "Qayta tekshirish" : "Ruxsat so‘rash"}
          </button>
        </div>
      </div>
    </div>
  );
}
