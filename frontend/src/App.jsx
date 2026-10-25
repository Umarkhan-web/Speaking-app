import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import { Home } from "./components/Home";
import { Vocab } from "./components/Vocab";
import { Progress } from "./components/Progress";
import { Profile } from "./components/Profile";
import { PracticeSession } from "./components/PracticeSession";
import { MicTestModal } from "./components/MicTestModal";
import { AuthScreen } from "./components/AuthScreen";
import { Onboarding } from "./components/Onboarding";
import { Icon3D } from "./components/Icon3D";
import { BADGES } from "./data/constants";
import { bestStreak } from "./utils/helpers";
import { buzz } from "./utils/audio";
import { fetchAITopics } from "./services/api";
import {
  supabase,
  signOut,
  syncUserProfile,
  saveSpeakingSessionToSupabase,
  fetchUserSpeakingSessions,
  saveVocabToSupabase,
  fetchUserVocab,
} from "./services/supabase";

const STORAGE_KEY = "birdan.v2";

const DEFAULT_STATE = {
  p: {
    name: "",
    goal: 1,
    sound: true,
    haptic: true,
    theme: "auto",
    lang: "en-US",
    mode: "std",
    level: 2,
    cat: "all",
    help: true,
    expl: "uz",
  },
  xp: 0,
  sessions: [],
  badges: {},
  vocab: [],
  currentTopic: null,
};

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        p: { ...DEFAULT_STATE.p, ...(parsed.p || {}) },
      };
    }
  } catch (e) {
    console.warn("Storage load failed:", e);
  }
  return DEFAULT_STATE;
}

export function App() {
  const [appState, setAppState] = useState(loadStoredState);
  const [activeTab, setActiveTab] = useState("home");
  const [activeSession, setActiveSession] = useState(false);
  const [micModalOpen, setMicModalOpen] = useState(false);
  const [micStatus, setMicStatus] = useState("unknown");
  const [toast, setToast] = useState({ text: "", visible: false, isError: false });
  const [aiTopics, setAiTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [appReady, setAppReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem("birdan.onboarded") !== "true";
  });

  // Ilovaga kirishda rasmlarni oldindan to'liq keshlab, chiroyli loader ko'rsatish
  useEffect(() => {
    let mounted = true;
    const startTime = Date.now();

    const preloadImages = async () => {
      const urls = [
        "/onboarding_1.webp",
        "/onboarding_2.webp",
        "/onboarding_3.webp",
        "/onboarding_1.png",
        "/onboarding_2.png",
        "/onboarding_3.png",
      ];

      const promises = urls.map(
        (url) =>
          new Promise((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
          })
      );

      await Promise.allSettled(promises);

      const elapsed = Date.now() - startTime;
      const minDisplay = 800; // 800ms elegant splash
      const remaining = Math.max(0, minDisplay - elapsed);

      setTimeout(() => {
        if (mounted) setAppReady(true);
      }, remaining);
    };

    preloadImages();

    return () => {
      mounted = false;
    };
  }, []);

  const showToast = useCallback((text, isError = false) => {
    setToast({ text, visible: true, isError });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  }, []);

  // Supabase Auth and Cloud Data Sync
  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const curUser = session?.user || null;
        setUser(curUser);
        if (curUser) {
          const userName = curUser.user_metadata?.full_name || curUser.email.split("@")[0];
          setAppState((prev) => ({
            ...prev,
            p: {
              ...prev.p,
              name: prev.p.name && prev.p.name !== "notiq" ? prev.p.name : userName,
            },
          }));

          fetchUserSpeakingSessions(curUser).then((remSessions) => {
            if (remSessions && remSessions.length > 0) {
              setAppState((prev) => {
                const localIds = new Set((prev.sessions || []).map((s) => s.id));
                const merged = [...remSessions.filter((rs) => !localIds.has(rs.id)), ...(prev.sessions || [])];
                return { ...prev, sessions: merged };
              });
            }
          });

          fetchUserVocab(curUser).then((remVocab) => {
            if (remVocab && remVocab.length > 0) {
              setAppState((prev) => {
                const localWords = new Set((prev.vocab || []).map((v) => v.en.toLowerCase()));
                const merged = [...remVocab.filter((rv) => !localWords.has(rv.en.toLowerCase())), ...(prev.vocab || [])];
                return { ...prev, vocab: merged };
              });
            }
          });
        }
      })
      .finally(() => {
        setLoadingAuth(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const curUser = session?.user || null;
      setUser(curUser);
      setLoadingAuth(false);
      if (curUser && (event === "SIGNED_IN" || event === "USER_UPDATED")) {
        const userName = curUser.user_metadata?.full_name || curUser.email.split("@")[0];
        setAppState((prev) => ({
          ...prev,
          p: {
            ...prev.p,
            name: prev.p.name && prev.p.name !== "notiq" ? prev.p.name : userName,
          },
        }));
        showToast(`Xush kelibsiz, ${userName}!`);
        syncUserProfile(curUser, appState);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      showToast("Tizimdan chiqildi.");
    } catch {
      showToast("Chiqishda xatolik yuz berdi", true);
    }
  };

  const loadAITopics = useCallback(async (level, category = "all", fresh = false) => {
    setLoadingTopics(true);
    try {
      const fetched = await fetchAITopics(level, category, fresh);
      if (fetched && fetched.length > 0) {
        setAiTopics(fetched);
        setAppState((prev) => {
          // If no currentTopic yet, or currentTopic belongs to a different level, choose first AI topic
          if (!prev.currentTopic || prev.currentTopic.lvl !== level) {
            return { ...prev, currentTopic: fetched[0] };
          }
          return prev;
        });
      }
    } catch (e) {
      console.warn("AI topics failed to load:", e);
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  const checkMicrophonePermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("denied");
      return;
    }
    try {
      if (navigator.permissions?.query) {
        const queryRes = await navigator.permissions.query({ name: "microphone" });
        setMicStatus(queryRes.state);
        queryRes.onchange = () => setMicStatus(queryRes.state);
      }
    } catch {
      // Fallback
    }
  }, []);

  const requestMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus("granted");
      showToast("Mikrofon muvaffaqiyatli yoqildi!");
      return true;
    } catch {
      setMicStatus("denied");
      showToast("Mikrofonga ruxsat berilmadi", true);
      return false;
    }
  }, [showToast]);

  // Save to localStorage on state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      console.warn("Storage save failed:", e);
    }
  }, [appState]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (appState.p.theme === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", appState.p.theme);
    }
  }, [appState.p.theme]);

  // Initial check of microphone permission
  useEffect(() => {
    checkMicrophonePermission();
  }, [checkMicrophonePermission]);

  // Load AI-generated questions immediately upon entering app
  useEffect(() => {
    loadAITopics(appState.p.level || 2, appState.p.cat || "all", false);
  }, [loadAITopics, appState.p.level]);

  // Check achievements after a session
  const checkBadges = (newSessions, newVocab) => {
    const updatedBadges = { ...appState.badges };
    const tempState = { ...appState, sessions: newSessions, vocab: newVocab };
    const userBest = bestStreak(newSessions);

    BADGES.forEach((b) => {
      if (!updatedBadges[b.id] && b.t(tempState, userBest)) {
        updatedBadges[b.id] = Date.now();
        setTimeout(() => {
          showToast(`Yangi medal qo‘lga kiritildi: ${b.n} ${b.e}`);
        }, 1200);
      }
    });

    return updatedBadges;
  };

  // Save completed session record
  const handleSaveSession = useCallback((sessionRecord) => {
    setAppState((prev) => {
      const earnedXp = (sessionRecord.analysis?.fluency_score || 5) * 4 + 20;
      const updatedSessions = [...(prev.sessions || []), sessionRecord];
      const updatedBadges = checkBadges(updatedSessions, prev.vocab || []);

      const nextState = {
        ...prev,
        xp: (prev.xp || 0) + earnedXp,
        sessions: updatedSessions,
        badges: updatedBadges,
      };

      // Sync to Supabase cloud if user is logged in
      if (user) {
        saveSpeakingSessionToSupabase(user, sessionRecord);
        syncUserProfile(user, nextState);
      }

      return nextState;
    });
  }, [user]);

  // Vocabulary save
  const handleSaveVocabWord = (newWord) => {
    const exists = (appState.vocab || []).some(
      (v) => v.en.toLowerCase() === newWord.en.toLowerCase()
    );

    if (exists) {
      setAppState((prev) => ({
        ...prev,
        vocab: prev.vocab.filter(
          (v) => v.en.toLowerCase() !== newWord.en.toLowerCase()
        ),
      }));
      showToast("Lug‘atdan olib tashlandi");
    } else {
      buzz(12, appState.p.haptic);
      const updatedVocab = [
        { ...newWord, t: Date.now() },
        ...(appState.vocab || []),
      ].slice(0, 300);

      const updatedBadges = checkBadges(appState.sessions, updatedVocab);

      setAppState((prev) => ({
        ...prev,
        vocab: updatedVocab,
        badges: updatedBadges,
      }));

      // Sync word to Supabase cloud if user is logged in
      if (user) {
        saveVocabToSupabase(user, newWord);
      }

      showToast("Lug‘atga saqlandi! ⭐️");
    }
  };

  const isWordSaved = (wordText) => {
    return (appState.vocab || []).some(
      (v) => v.en.toLowerCase() === (wordText || "").toLowerCase()
    );
  };

  // 1. Splash screen while checking auth session & preloading images
  if (!appReady || loadingAuth) {
    return (
      <div
        id="app"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100%",
          background: "var(--bg)",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: "18px",
            animation: "scr 0.35s ease-out",
          }}
        >
          <div
            style={{
              width: "86px",
              height: "86px",
              borderRadius: "26px",
              background: "var(--card)",
              border: "2.5px solid var(--edge)",
              boxShadow: "0 8px 0 var(--edge)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ transform: "scale(1.2)" }}>
              <Icon3D name="crown" size={52} />
            </div>
          </div>

          <div>
            <h1
              className="disp"
              style={{
                fontSize: "32px",
                lineHeight: 1,
                margin: "0 0 6px 0",
                color: "var(--fg)",
              }}
            >
              Birdan<i>!</i>
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "13.5px",
                fontWeight: "600",
                color: "var(--muted)",
              }}
            >
              IELTS Speaking sun’iy intellekt murabbiyi
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 18px",
              background: "rgba(0, 0, 0, 0.05)",
              borderRadius: "999px",
              border: "1.5px solid var(--edge)",
              marginTop: "4px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--tang, #ff5722)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "12.5px",
                fontWeight: "700",
                color: "var(--muted)",
              }}
            >
              Yuklanmoqda...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Onboarding Preview Carousel (Yangi foydalanuvchilar yoki ko'rishni xohlaganlar uchun)
  if (showOnboarding) {
    return (
      <div id="app" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Onboarding
          onComplete={() => {
            localStorage.setItem("birdan.onboarded", "true");
            setShowOnboarding(false);
          }}
        />
      </div>
    );
  }

  // 3. Auth Guard: Agar foydalanuvchi kirmagan bo'lsa, ilovaning ichi umuman chiqmasin!
  if (!user) {
    return (
      <div id="app" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <AuthScreen onAuthSuccess={(u) => setUser(u)} onToast={showToast} />
        {/* Toast Alert */}
        <div
          id="toast"
          className={`${toast.visible ? "on" : ""} ${toast.isError ? "err" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      {/* Scrollable Screens Container */}
      <main id="screens">
        {activeTab === "home" && (
          <Home
            state={appState}
            setState={setAppState}
            topics={aiTopics}
            onStartSession={() => setActiveSession(true)}
            onOpenMicTest={() => setMicModalOpen(true)}
            micStatus={micStatus}
            user={user}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === "vocab" && (
          <Vocab
            state={appState}
            setState={setAppState}
            onToast={showToast}
          />
        )}

        {activeTab === "prog" && <Progress state={appState} />}

        {activeTab === "me" && (
          <Profile
            state={appState}
            setState={setAppState}
            onOpenMicTest={() => setMicModalOpen(true)}
            micStatus={micStatus}
            onToast={showToast}
            user={user}
            onSignOut={handleSignOut}
            onShowOnboarding={() => setShowOnboarding(true)}
          />
        )}
      </main>

      {/* Bottom Floating Navigation */}
      <nav id="nav" aria-label="Asosiy menyu">
        <button
          className={activeTab === "home" ? "on" : ""}
          onClick={() => {
            buzz(8, appState.p.haptic);
            setActiveTab("home");
          }}
          aria-label="Mashq"
        >
          <Icon3D name="mic" size={26} />
          <span>Mashq</span>
        </button>

        <button
          className={activeTab === "vocab" ? "on" : ""}
          onClick={() => {
            buzz(8, appState.p.haptic);
            setActiveTab("vocab");
          }}
          aria-label="Lug‘at"
        >
          <Icon3D name="book" size={26} />
          <span>Lug‘at</span>
        </button>

        <button
          className={activeTab === "prog" ? "on" : ""}
          onClick={() => {
            buzz(8, appState.p.haptic);
            setActiveTab("prog");
          }}
          aria-label="Natijalar"
        >
          <Icon3D name="trophy" size={26} />
          <span>Natija</span>
        </button>

        <button
          className={activeTab === "me" ? "on" : ""}
          onClick={() => {
            buzz(8, appState.p.haptic);
            setActiveTab("me");
          }}
          aria-label="Profil"
        >
          <Icon3D name="profile" size={26} />
          <span>Profil</span>
        </button>
      </nav>

      {/* Practice Session Overlay */}
      {activeSession && (
        <PracticeSession
          topic={
            appState.currentTopic || {
              en: "My daily routine",
              uz: "Kundalik tartibim",
              lvl: 1,
              q: ["What time do you wake up?"],
            }
          }
          modeKey={appState.p.mode || "std"}
          profile={appState.p}
          onClose={() => setActiveSession(false)}
          onSaveSession={handleSaveSession}
          onToast={showToast}
          onSaveVocabWord={handleSaveVocabWord}
          isWordSaved={isWordSaved}
          onOpenMicTest={() => setMicModalOpen(true)}
          micStatus={micStatus}
        />
      )}

      {/* Microphone Test Bottom Modal */}
      <MicTestModal
        isOpen={micModalOpen}
        onClose={() => setMicModalOpen(false)}
        onCheckPermission={requestMicrophonePermission}
        micStatus={micStatus}
      />

      {/* Toast Alert */}
      <div
        id="toast"
        className={`${toast.visible ? "on" : ""} ${toast.isError ? "err" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast.text}
      </div>

      {/* Confetti Animation Canvas */}
      <canvas id="fx" />
    </div>
  );
}

export default App;
