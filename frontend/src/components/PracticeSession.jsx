import React, { useState, useEffect, useRef, useCallback } from "react";
import { MODES, PHRASES } from "../data/constants";
import { fmt, textStats, clamp } from "../utils/helpers";
import { beep, buzz, say, requestWakeLock, releaseWakeLock } from "../utils/audio";
import { triggerConfetti } from "../utils/confetti";
import { transcribeAudio, analyzeTranscript } from "../services/api";
import { AudioRecorder } from "../utils/wavRecorder";
import { Icon3D } from "./Icon3D";

const CIRCUMFERENCE = 2 * Math.PI * 88;

export function PracticeSession({
  topic,
  modeKey,
  profile,
  onClose,
  onSaveSession,
  onToast,
  onSaveVocabWord,
  isWordSaved,
  onOpenMicTest,
  micStatus,
}) {
  const mode = MODES[modeKey] || MODES.std;

  // Phases: 'think' | 'speak' | 'loading' | 'res'
  const [phase, setPhase] = useState("think");
  const [timeLeft, setTimeLeft] = useState(mode.think);
  const [loadingStep, setLoadingStep] = useState(0); // 0: transcribing, 1: analyzing
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  // Recording data
  const [speakingDuration, setSpeakingDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [subtitles, setSubtitles] = useState([]);
  const [analysis, setAnalysis] = useState(null);

  // Outline notes during think phase
  const [notes, setNotes] = useState(["", "", ""]);

  // Results tab
  const [activeTab, setActiveTab] = useState("sum");

  // Refs for recording and timing
  const audioRecorderRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);
  const isStoppingRef = useRef(false);

  // Audio wave visualizer ref
  const waveAnimRef = useRef(null);
  const sheetRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Har bir bosqich almashganda sahifani eng tepaga qaytarish (kesilib qolishni oldini oladi)
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.scrollTop = 0;
    }
  }, [phase]);

  // Stable references for props to prevent effect re-triggering
  const onSaveSessionRef = useRef(onSaveSession);
  onSaveSessionRef.current = onSaveSession;

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const topicRef = useRef(topic);
  topicRef.current = topic;

  const modeKeyRef = useRef(modeKey);
  modeKeyRef.current = modeKey;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const cleanupTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    if (waveAnimRef.current) {
      cancelAnimationFrame(waveAnimRef.current);
      waveAnimRef.current = null;
    }
    if (audioRecorderRef.current) {
      try {
        audioRecorderRef.current.stop();
      } catch {}
      audioRecorderRef.current = null;
    }
  }, []);

  // 3. SEND AUDIO TO BACKEND & AI ANALYSIS
  const handleProcessAudio = useCallback(async (blob, durationSec) => {
    cleanupTimers();

    if (!blob || blob.size === 0) {
      setError("Audio yozilmadi. Qaytadan urinib ko'ring.");
      setPhase("think");
      return;
    }

    setPhase("loading");
    setLoadingStep(0);
    setLoadingMessage("Audio matnga aylantirilmoqda...");

    try {
      // 1. Transcribe
      const transcribeResult = await transcribeAudio(blob);
      const recognizedText = (transcribeResult.transcript || "").trim();
      const recognizedSubtitles = transcribeResult.subtitles || [];

      setTranscript(recognizedText);
      setSubtitles(recognizedSubtitles);

      if (!recognizedText) {
        throw new Error(
          "Nutq aniqlanmadi. Iltimos, mikrofon yaqinida aniqroq ingliz tilida gapiring."
        );
      }

      // 2. Analyze
      setLoadingStep(1);
      setLoadingMessage("Nutqingiz tahlil qilinmoqda...");

      const durationFinal = durationSec || Math.round(transcribeResult.duration || 10);
      const avgLogprobFinal = transcribeResult.avg_logprob != null ? transcribeResult.avg_logprob : -0.3;

      const analyzeResult = await analyzeTranscript(recognizedText, durationFinal, avgLogprobFinal);
      const aiAnalysis = analyzeResult.analysis;

      setAnalysis(aiAnalysis);
      setPhase("res");

      // Save session record safely without restarting the session
      const stats = textStats(recognizedText, durationSec || 1);
      const currentTopic = topicRef.current;
      const currentModeKey = modeKeyRef.current;
      const sessionRecord = {
        t: Date.now(),
        day: new Date().toISOString().slice(0, 10),
        topic: currentTopic?.en || "Practice",
        lvl: currentTopic?.lvl || 1,
        mode: currentModeKey || "std",
        speak: durationSec || Math.round(transcribeResult.duration || 10),
        words: stats.n,
        wpm: stats.wpm,
        uniq: stats.uniq,
        fill: stats.fill,
        transcript: recognizedText,
        subtitles: recognizedSubtitles,
        analysis: aiAnalysis,
      };

      if (onSaveSessionRef.current) {
        onSaveSessionRef.current(sessionRecord);
      }

      // Confetti celebration if score is good!
      if (aiAnalysis?.fluency_score >= 7) {
        setTimeout(triggerConfetti, 350);
      }
    } catch (err) {
      console.error("Backend error:", err);
      setError(err.message || "Tahlil jarayonida xatolik yuz berdi.");
      setPhase("think");
    }
  }, [cleanupTimers]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    cleanupTimers();
    if (waveAnimRef.current) {
      cancelAnimationFrame(waveAnimRef.current);
      waveAnimRef.current = null;
    }

    const currentMode = modeRef.current;
    const currentProfile = profileRef.current;
    const duration = startTimeRef.current
      ? (performance.now() - startTimeRef.current) / 1000
      : currentMode?.speak || 30;
    const durationRounded = Math.max(1, Math.round(duration));
    setSpeakingDuration(durationRounded);

    beep(660, 0.12, "triangle", 0.06, currentProfile?.sound);
    buzz([30, 40, 60], currentProfile?.haptic);

    let wavBlob = null;
    if (audioRecorderRef.current) {
      try {
        wavBlob = audioRecorderRef.current.stop();
      } catch (err) {
        console.error("AudioRecorder stop error:", err);
      }
      audioRecorderRef.current = null;
    }

    if (wavBlob) {
      handleProcessAudio(wavBlob, durationRounded);
    } else {
      setError("Audio yozilmadi. Qaytadan urinib ko'ring.");
      setPhase("think");
    }
  }, [cleanupTimers, handleProcessAudio]);

  // 2. SPEAK PHASE & RECORDING
  const startSpeakPhase = useCallback(async () => {
    cleanupTimers();
    setError("");
    setPhase("speak");
    const currentMode = modeRef.current;
    const currentProfile = profileRef.current;
    setTimeLeft(currentMode?.speak || 30);
    isStoppingRef.current = false;

    beep(784, 0.12, "triangle", 0.06, currentProfile?.sound);
    setTimeout(() => beep(1175, 0.22, "triangle", 0.06, currentProfile?.sound), 130);
    buzz([40, 50, 40], currentProfile?.haptic);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Mikrofon qo'llab-quvvatlanmadi. Brauzeringizni tekshiring.");
      }

      const recorder = new AudioRecorder();
      audioRecorderRef.current = recorder;
      await recorder.start();

      startTimeRef.current = performance.now();

      // Audio wave visualizer loop
      const updateWave = () => {
        if (audioRecorderRef.current) {
          const level = audioRecorderRef.current.getAudioLevel();
          setAudioLevel(level);
          waveAnimRef.current = requestAnimationFrame(updateWave);
        }
      };
      waveAnimRef.current = requestAnimationFrame(updateWave);

      // Countdown loop
      const start = performance.now();
      const total = currentMode?.speak || 30;
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (performance.now() - start) / 1000;
        const remaining = Math.max(0, total - elapsed);
        const roundedSec = Math.ceil(remaining);
        setTimeLeft(remaining);

        if (remaining <= 5 && remaining > 0 && Math.abs(roundedSec - remaining) < 0.1) {
          beep(600, 0.07, "square", 0.04, profileRef.current?.sound);
        }

        // Automatic stop and AI analysis when time expires!
        if (remaining <= 0) {
          cleanupTimers();
          stopRecording();
        }
      }, 100);
    } catch (err) {
      console.error("Recording error:", err);
      setError(
        err.name === "NotAllowedError"
          ? "Mikrofonga ruxsat berilmadi. Iltimos, mikrofonga ruxsat bering."
          : err.message || "Mikrofonni ishga tushirishda xatolik yuz berdi."
      );
      setPhase("think");
    }
  }, [cleanupTimers, stopRecording]);

  // 1. THINK PHASE TIMER
  const startThinkTimer = useCallback(() => {
    cleanupTimers();
    setPhase("think");
    const currentMode = modeRef.current;
    const currentProfile = profileRef.current;
    const total = currentMode?.think || 15;
    setTimeLeft(total);
    const start = performance.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const remaining = Math.max(0, total - elapsed);
      const roundedSec = Math.ceil(remaining);
      setTimeLeft(remaining);

      if (remaining <= 3 && remaining > 0 && Math.abs(roundedSec - remaining) < 0.1) {
        beep(520, 0.08, "square", 0.04, profileRef.current?.sound);
        buzz(15, profileRef.current?.haptic);
      }

      if (remaining <= 0) {
        cleanupTimers();
        startSpeakPhase();
      }
    }, 100);
  }, [cleanupTimers, startSpeakPhase]);

  // Initialize session and wake lock on mount only
  useEffect(() => {
    requestWakeLock();
    startThinkTimer();

    return () => {
      cleanupTimers();
      cleanupAudio();
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate ring dash offset
  const totalPhaseTime = phase === "think" ? mode.think : mode.speak;
  const progressPercent = clamp((totalPhaseTime - timeLeft) / totalPhaseTime, 0, 1);
  const ringDashOffset = CIRCUMFERENCE * (1 - progressPercent);
  const displaySeconds = Math.ceil(timeLeft);

  // Helper phrase click
  const handleInsertPhrase = (phraseText) => {
    buzz(6, profile.haptic);
    onToast(`Iborani eslab qoling: "${phraseText}"`);
  };

  return (
    <div id="session" className={`ph-${phase}`}>
      <div className="sheet" ref={sheetRef}>
        {/* Top bar */}
        <div className="sb">
          <button className="x" onClick={onClose} aria-label="Yopish">
            <svg viewBox="0 0 24 24">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
          <span className="pill">
            {phase === "think"
              ? "O‘ylang"
              : phase === "speak"
              ? "Gapiring!"
              : phase === "loading"
              ? "Tahlil qilinmoqda"
              : "Natija"}
          </span>
          <span className="mtag">{mode.n}</span>
        </div>

        {/* Error notification */}
        {error && (
          <div className="err-banner">
            ❌ {error}
          </div>
        )}

        {/* ===================== 1. THINK PHASE ===================== */}
        {phase === "think" && (
          <>
            {/* Topic preview card */}
            <div className="combo pc">
              <div className="ct">{topic.en}</div>
              <div className="cu">{topic.uz}</div>
              <ul>
                {topic.q?.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>

            {/* Countdown ring */}
            <div className="ringwrap">
              <svg className="ring" viewBox="0 0 200 200" aria-hidden="true">
                <circle className="tk" cx="100" cy="100" r="88" />
                <circle
                  className={`fg ${timeLeft <= 3 ? "warn" : ""}`}
                  cx="100"
                  cy="100"
                  r="88"
                  transform="rotate(-90 100 100)"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={ringDashOffset}
                />
              </svg>
              <div className="rnum">{displaySeconds}</div>
            </div>

            {/* Sentence starter helpers */}
            {profile.help && (
              <div className="hlp pc">
                <h4>Gap shablonlari</h4>
                {PHRASES.map(([groupTitle, phraseList], idx) => (
                  <div className="hrow" key={idx}>
                    <b>{groupTitle}</b>
                    {phraseList.map(([enText, uzText], i) => (
                      <span
                        className="ph"
                        key={i}
                        onClick={() => handleInsertPhrase(enText)}
                        style={{ cursor: "pointer" }}
                      >
                        {enText}
                        <small>{uzText}</small>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* 3 Outline planning steps */}
            <div className="steps">
              {["Boshlanish: birinchi gap", "Misol yoki hikoya", "Xulosa: oxirgi gap"].map(
                (placeholder, i) => (
                  <label className="stp" key={i}>
                    <i>{i + 1}</i>
                    <input
                      type="text"
                      maxLength={70}
                      placeholder={placeholder}
                      value={notes[i]}
                      onChange={(e) => {
                        const next = [...notes];
                        next[i] = e.target.value;
                        setNotes(next);
                      }}
                      autoComplete="off"
                    />
                  </label>
                )
              )}
            </div>

            {/* Microphone Status & Test Chip (Ko'chirilgan: Gapirishdan oldingi tayyorgarlik) */}
            {onOpenMicTest && (
              <button
                className={`micchip ${
                  micStatus === "granted" ? "ok" : micStatus === "denied" ? "bad" : ""
                }`}
                onClick={onOpenMicTest}
                type="button"
                style={{ margin: "14px 0 6px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Icon3D name="mic" size={20} />
                <span>
                  {micStatus === "granted"
                    ? "Mikrofon tayyor (sinab ko‘rish)"
                    : micStatus === "denied"
                    ? "Mikrofon bloklangan (sozlash)"
                    : "Mikrofonni tekshirish"}
                </span>
              </button>
            )}

            {/* Action ready button */}
            <div className="foot-s">
              <button className="bigbtn" onClick={startSpeakPhase} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <Icon3D name="rocket" size={24} />
                Tayyorman
              </button>
            </div>
          </>
        )}

        {/* ===================== 2. SPEAK PHASE ===================== */}
        {phase === "speak" && (
          <div className="speak-phase-container">
            {/* Topic mini card */}
            <div className="combo pc mini">
              <div className="ct">{topic.en}</div>
              {topic.q && topic.q.length > 0 && (
                <ul>
                  {topic.q.slice(0, 2).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Smaller countdown ring */}
            <div className="ringwrap sm">
              <svg className="ring" viewBox="0 0 200 200" aria-hidden="true">
                <circle className="tk" cx="100" cy="100" r="88" />
                <circle
                  className={`fg ${timeLeft <= 5 ? "warn" : ""}`}
                  cx="100"
                  cy="100"
                  r="88"
                  transform="rotate(-90 100 100)"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={ringDashOffset}
                />
              </svg>
              <div className="rnum">{displaySeconds}</div>
            </div>

            {/* Equalizer audio wave */}
            <div className="wave">
              {Array.from({ length: 24 }).map((_, i) => {
                const waveHeight = Math.max(
                  0.15,
                  Math.min(1, 0.15 + audioLevel * 2.4 * (0.6 + Math.sin(i * 0.4) * 0.4))
                );
                return (
                  <i
                    key={i}
                    style={{
                      transform: `scaleY(${waveHeight.toFixed(2)})`,
                    }}
                  />
                );
              })}
            </div>

            {/* Clean, pulsing live recording status badge */}
            <div className="rec-badge">
              <span className="rec-dot" />
              <span>Mikrofon tinglamoqda — inglizcha gapiring</span>
            </div>

            {/* Phrase helpers (essential 4-5 starters, fits nicely on screen) */}
            {profile.help && (
              <div className="speak-phrases">
                <div className="speak-phrases-label">Yordamchi iboralar:</div>
                <div className="speak-phrases-chips">
                  {["Today I'd like to talk about...", "For example,...", "What's more,...", "In my opinion,..."]
                    .map((enText, idx) => (
                      <span className="speak-chip" key={idx}>
                        {enText}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Stop button (clear spacing, never covered) */}
            <div className="foot-s">
              <button className="bigbtn stop" onClick={stopRecording} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <Icon3D name="cross" size={22} />
                Tugatish
              </button>
            </div>
          </div>
        )}

        {/* ===================== 3. LOADING PHASE ===================== */}
        {phase === "loading" && (
          <div className="loading-card pc">
            <h3 className="disp" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
              <Icon3D name="sparkle" size={28} />
              Nutq Tahlil Qilinmoqda
            </h3>
            <p>{loadingMessage}</p>

            <div className="prog">
              <i />
            </div>

            <ul className="asteps">
              <li className={loadingStep === 0 ? "on" : "ok"}>
                <i />
                1. Nutqni matnga aylantirish
              </li>
              <li className={loadingStep === 1 ? "on" : ""}>
                <i />
                2. Grammatika va ravonlik tahlili
              </li>
            </ul>
          </div>
        )}

        {/* ===================== 4. RESULT PHASE ===================== */}
        {phase === "res" && analysis && (
          <>
            <div className="rh disp">
              {analysis.fluency_score >= 8
                ? "Ajoyib natija!"
                : analysis.fluency_score >= 6
                ? "Yaxshi urinish!"
                : "Davom eting!"}
            </div>

            {/* Retro Ticket Card */}
            <div className="ticket">
              <div className="tk-t">{topic.en}</div>
              <div className="tk-s">{topic.uz}</div>
              <div className="stamp">+{mode.xp + 15} XP</div>

              <div className="tk-r">
                <span>Gapirgan vaqt</span>
                <b>{fmt(speakingDuration)}</b>
              </div>

              {(() => {
                const st = textStats(transcript, speakingDuration);
                return (
                  <>
                    <div className="tk-r">
                      <span>So‘zlar soni</span>
                      <b>{st.n}</b>
                    </div>
                    <div className="tk-r">
                      <span>Tezlik</span>
                      <b>
                        {st.wpm ? (
                          <>
                            {st.wpm} <em>so‘z/daq</em>
                            <small
                              className={
                                st.wpm < 85 ? "w" : st.wpm <= 150 ? "" : "bad"
                              }
                            >
                              {st.wpm < 85
                                ? "sekin"
                                : st.wpm <= 150
                                ? "ideal"
                                : "tez"}
                            </small>
                          </>
                        ) : (
                          "–"
                        )}
                      </b>
                    </div>
                    <div className="tk-r">
                      <span>So‘z xilma-xilligi</span>
                      <b>{st.uniq}%</b>
                    </div>
                    <div className="tk-r">
                      <span>To‘ldiruvchi so‘zlar</span>
                      <b>{st.fill}</b>
                    </div>
                    {st.rep.length > 0 && (
                      <div className="tk-r">
                        <span>Ko‘p takrorlangan</span>
                        <b>
                          <em>{st.rep.join(", ")}</em>
                        </b>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Transcript Panel */}
            <div className="panel pc">
              <h3 className="disp">📝 Sizning nutqingiz</h3>
              <div className="tx">{transcript}</div>
            </div>

            {/* AI Analysis Hero Banner */}
            <div className="panel pc hero">
              <div className="sring">
                <svg viewBox="0 0 110 110">
                  <circle className="a" cx="55" cy="55" r="46" />
                  <circle
                    className="b"
                    cx="55"
                    cy="55"
                    r="46"
                    transform="rotate(-90 55 55)"
                    style={{
                      strokeDashoffset: `${
                        289 * (1 - (analysis.overall_score || (analysis.fluency_score || 5) * 10) / 100)
                      }`,
                    }}
                  />
                </svg>
                <b>{analysis.overall_score || (analysis.fluency_score || 5) * 10}</b>
              </div>
              <div className="ht">
                <div>
                  <span className="cefr">{analysis.vocabulary_level || "B1"}</span>
                  <span className="band-badge">
                    IELTS {analysis.estimated_ielts_band || "6.0"}
                  </span>
                </div>
                <p>
                  <strong>Xulosa:</strong> {analysis.summary || analysis.fluency_feedback}
                </p>
              </div>
            </div>

            {/* 5 Skills Progress Breakdown */}
            <div className="panel pc">
              <h4 className="disp" style={{ margin: "0 0 12px", fontSize: "18px" }}>
                📊 Ko‘nikmalar Bahosi
              </h4>
              <div className="sk">
                {[
                  ["pronunciation", "Talaffuz", "var(--pink)", analysis.scores?.pronunciation ?? 70],
                  ["grammar", "Grammatika", "var(--cobalt)", analysis.scores?.grammar ?? 72],
                  ["vocabulary", "Lug‘at boyligi", "var(--mint)", analysis.scores?.vocabulary ?? 68],
                  ["fluency", "Ravonlik", "var(--tang)", analysis.scores?.fluency ?? ((analysis.fluency_score || 7) * 10)],
                  ["content", "Mazmun", "var(--butter)", analysis.scores?.content ?? 70],
                ].map(([skillKey, label, color, scoreVal]) => (
                  <div className="skr" key={skillKey}>
                    <span>{label}</span>
                    <div className="skt">
                      <i style={{ width: `${Math.max(10, Math.min(100, scoreVal))}%`, background: color }} />
                    </div>
                    <em>{scoreVal}</em>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Breakdown Tabs */}
            <div className="tabs">
              {[
                ["tips", "bulb", "Maslahatlar"],
                ["sum", "chart", "Xulosa"],
                ["err", "cross", `Xatolar (${analysis.grammar_errors?.length || 0})`],
                ["voc", "book", "Lug‘at"],
                ["sub", "memo", `Subtitrlar (${subtitles.length})`],
                ["mod", "speaker", "Namuna"],
              ].map(([tKey, iconName, label]) => (
                <button
                  key={tKey}
                  className={activeTab === tKey ? "on" : ""}
                  onClick={() => {
                    buzz(8, profile.haptic);
                    setActiveTab(tKey);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Icon3D name={iconName} size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="tb">
              {/* TAB: MASLAHATLAR & TAKLIFLAR (Coach Advice, Creative Tips & Connectors) */}
              {activeTab === "tips" && (
                <>
                  {/* Murabbiy Maslahatlari */}
                  <div className="panel pc">
                    <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon3D name="bulb" size={24} />
                      <span>Murabbiy Maslahatlari</span>
                    </h3>
                    <p style={{ margin: "0 0 14px", color: "#3a4073", fontSize: "14.5px" }}>
                      Nutqingizni yanada ravon va boy qilish uchun murabbiy tavsiyalari:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(analysis.coach_tips || [
                        "Fikringizni kengaytirish uchun 'For instance' yoki 'Because of this' bog'lovchilaridan foydalaning.",
                        "Gaplaringiz orasida 1-2 soniya xotirjam pauza qiling va shoshilmasdan gapiring.",
                      ]).map((tip, idx) => (
                        <div className="tipc" key={idx} style={{ marginTop: 0 }}>
                          <Icon3D name="bulb" size={20} />
                          <div>
                            <b>Maslahat #{idx + 1}:</b>
                            <div style={{ marginTop: "3px" }}>{tip}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fikrni bog'lovchi iboralar (Connectors) */}
                  <div className="panel pc">
                    <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon3D name="puzzle" size={24} />
                      <span>Fikrni Bog‘lovchi Iboralar</span>
                    </h3>
                    <p style={{ margin: "0 0 12px", color: "#3a4073", fontSize: "14.5px" }}>
                      Nutqingiz uzilib qolmasligi va ravon eshitilishi uchun tavsiya etilgan iboralar:
                    </p>
                    {(analysis.recommended_connectors || [
                      {
                        word: "Furthermore",
                        meaning: "Bundan tashqari",
                        example: "Furthermore, learning English allows me to travel freely.",
                      },
                      {
                        word: "For instance",
                        meaning: "Masalan",
                        example: "For instance, I can speak with people around the world.",
                      },
                      {
                        word: "In my perspective",
                        meaning: "Mening nazarimda",
                        example: "In my perspective, daily practice is the key to success.",
                      },
                    ]).map((conn, idx) => (
                      <div className="mc pc" key={idx} style={{ marginTop: idx === 0 ? 0 : "10px", background: "#f8f9ff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <b style={{ fontSize: "17px", color: "#0B1040" }}>{conn.word}</b>
                          <span className="mt" style={{ background: "#5FE3B2" }}>{conn.meaning}</span>
                        </div>
                        {conn.example && (
                          <div style={{ marginTop: "8px", fontStyle: "italic", fontSize: "14.5px", color: "#2a3066" }}>
                            "{conn.example}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* PREP Texnikasi (Speaking expansion rule) */}
                  <div className="panel pc" style={{ background: "#fdf8ee" }}>
                    <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon3D name="rocket" size={24} />
                      <span>PREP Formula (Fikrni Kengaytirish)</span>
                    </h3>
                    <p style={{ margin: "0 0 12px", fontSize: "14px", color: "#48432a" }}>
                      IELTS va erkin muloqotda javobingizni 4 qadamda to‘liq ochib bering:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <span style={{ background: "#FF5C9A", color: "#fff", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", fontSize: "13px" }}>P</span>
                        <div style={{ fontSize: "14px" }}><b>Point:</b> Asosiy javobingizni bitta gapda ayting.</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <span style={{ background: "#5FE3B2", color: "#0B1040", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", fontSize: "13px" }}>R</span>
                        <div style={{ fontSize: "14px" }}><b>Reason:</b> Nega shunday deb o‘ylashingizni 'Because/Since' deb tushuntiring.</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <span style={{ background: "#FFE45E", color: "#0B1040", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", fontSize: "13px" }}>E</span>
                        <div style={{ fontSize: "14px" }}><b>Example:</b> Hayotingizdan aniq bir misol keltiring ('For example...').</div>
                      </div>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <span style={{ background: "#38bdf8", color: "#0B1040", fontWeight: 800, padding: "2px 8px", borderRadius: "6px", fontSize: "13px" }}>P</span>
                        <div style={{ fontSize: "14px" }}><b>Point:</b> Xulosa qilib fikringizni tasdiqlang ('Overall...').</div>
                      </div>
                    </div>
                  </div>

                  {/* Next Goal Box */}
                  <div className="goalbox" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Icon3D name="target" size={26} />
                    <div>
                      <b>Keyingi maqsad:</b>{" "}
                      {analysis.next_goal || "Keyingi mashqda kamida bitta shaxsiy tajribangizni misol qilib keltiring."}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 1: XULOSA (Strengths & Next steps) */}
              {activeTab === "sum" && (
                <>
                  <div className="panel pc">
                    <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon3D name="trophy" size={24} />
                      <span>Kuchli tomonlaringiz</span>
                    </h3>
                    <ul className="chk">
                      {analysis.strengths?.length > 0 ? (
                        analysis.strengths.map((str, i) => (
                          <li key={i}>{str}</li>
                        ))
                      ) : (
                        <li>Gapirishga jur’at qildingiz. Bu eng muhim qadam!</li>
                      )}
                    </ul>
                  </div>

                  <div className="panel pc">
                    <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon3D name="target" size={24} />
                      <span>Nimani yaxshilash kerak</span>
                    </h3>
                    <ul className="chk adv">
                      {(analysis.advice || analysis.next_steps || []).length > 0 ? (
                        (analysis.advice || analysis.next_steps).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))
                      ) : (
                        <li>Har kuni bittadan mavzuda gapirishda davom eting.</li>
                      )}
                    </ul>
                  </div>

                  <div className="goalbox" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Icon3D name="target" size={26} />
                    <div>
                      <b>Keyingi maqsad:</b>{" "}
                      {analysis.next_goal || "Keyingi mashqda kamida bitta shaxsiy tajribangizni misol qilib keltiring."}
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: XATOLAR (Grammar errors) */}
              {activeTab === "err" && (
                <div>
                  {analysis.grammar_errors?.length > 0 ? (
                    analysis.grammar_errors.map((errItem, i) => (
                      <div className="mc pc" key={i}>
                        <span className="mt">Grammatika xatosi</span>
                        <div className="o" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Icon3D name="cross" size={16} />
                          <span>{errItem.original}</span>
                        </div>
                        <div className="f" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Icon3D name="check" size={16} />
                          <span>{errItem.correction}</span>
                        </div>
                        <div className="w" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Icon3D name="bulb" size={16} />
                          <span>{errItem.explanation}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="okmsg" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Icon3D name="check" size={22} />
                      <span>Jiddiy grammatik xato aniqlanmadi. Ajoyib ish!</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SUBTITRLAR (Whisper subtitles) */}
              {activeTab === "sub" && (
                <div className="panel pc">
                  <h3 className="disp" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon3D name="clock" size={24} />
                    <span>Subtitrlar va Vaqt</span>
                  </h3>
                  {subtitles.length > 0 ? (
                    <div className="subtitles-box">
                      {subtitles.map((sub, idx) => (
                        <div className="subitem" key={idx}>
                          <span className="ts">
                            {sub.start}s → {sub.end}s
                          </span>
                          <p>{sub.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>Subtitrlar mavjud emas.</p>
                  )}
                </div>
              )}

              {/* TAB 4: LUG'AT (Vocabulary level & suggestions) */}
              {activeTab === "voc" && (
                <div>
                  <div className="panel pc" style={{ marginBottom: "12px" }}>
                    <h3 className="disp">Lug‘at Darajasi: {analysis.vocabulary_level || "B1"}</h3>
                    <p style={{ margin: 0, color: "#3a4073", fontSize: "14.5px" }}>
                      Quyidagi iboralarni o‘zlashtirib, nutqingizni boyiting:
                    </p>
                  </div>

                  {analysis.vocabulary_suggestions?.length > 0 ? (
                    analysis.vocabulary_suggestions.map((vItem, i) => {
                      const isSaved = isWordSaved(vItem.better);
                      return (
                        <div className="vc pc" key={i}>
                          <div className="vt">
                            <div className="vr">
                              {vItem.original && <s>{vItem.original}</s>}
                              <b>{vItem.better}</b>
                            </div>
                            <div className="u">{vItem.meaning}</div>
                          </div>
                          <button
                            className={`ib ${isSaved ? "on" : ""}`}
                            onClick={() => {
                              onSaveVocabWord({
                                en: vItem.better,
                                uz: vItem.meaning || "",
                                ex: `Better way to say: "${vItem.original || ""}"`,
                              });
                            }}
                            title="Lug‘atga saqlash"
                            aria-label="Lug‘atga saqlash"
                          >
                            <Icon3D name="star" size={18} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="okmsg">Hozircha yangi so‘z tavsiyasi yo‘q.</div>
                  )}
                </div>
              )}

              {/* TAB 5: NAMUNA (Improved Answer with Audio) */}
              {activeTab === "mod" && (
                <div className="panel pc">
                  <h3 className="disp">Tabiiyroq Takomillashtirilgan Variant</h3>
                  <div className="corr">
                    {analysis.improved_answer || "Namuna javob topilmadi."}
                  </div>
                  {analysis.improved_answer && (
                    <div className="rowb">
                      <button
                        onClick={() =>
                          say(analysis.improved_answer, false, profile.lang || "en-US")
                        }
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      >
                        <Icon3D name="speaker" size={18} />
                        Eshitish
                      </button>
                      <button
                        onClick={() =>
                          say(analysis.improved_answer, true, profile.lang || "en-US")
                        }
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                      >
                        <Icon3D name="speaker" size={18} />
                        Sekin
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom result actions */}
            <div className="ftb">
              <button
                className="a"
                onClick={() => {
                  buzz(8, profile.haptic);
                  startThinkTimer();
                }}
              >
                Qayta urinish
              </button>
              <button className="b" onClick={onClose}>
                Yopish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
