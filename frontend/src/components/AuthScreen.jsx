import React, { useState, useEffect } from "react";
import { Icon3D } from "./Icon3D";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  verifyEmailOtp,
  resendVerificationEmail,
  isSupabaseConfigured,
  supabase,
} from "../services/supabase";

export function AuthScreen({ onAuthSuccess, onToast }) {
  // Foydalanuvchi talabi: Ro'yxatdan o'tish default holatda tursin
  const [mode, setMode] = useState("register"); // 'register' | 'login'
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  // Gmail tasdiqlash holati (email yuborilgandan keyin)
  const [awaitingEmailConfirm, setAwaitingEmailConfirm] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Gmaildan tasdiqlash bosilganda avtomatik sezish (Auth State Listener)
  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (onToast) onToast("Email tasdiqlandi! Xush kelibsiz! 🎉");
        if (onAuthSuccess) onAuthSuccess(session.user);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [onAuthSuccess, onToast]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setInfoMsg("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error("Tizim kalitlari sozlanmagan.");
      }
      await signInWithGoogle();
    } catch (err) {
      console.error("Google sign in error:", err);
      let msg = err.message || "Google orqali kirishda xatolik yuz berdi.";
      if (
        msg.toLowerCase().includes("not enabled") ||
        msg.toLowerCase().includes("unsupported provider")
      ) {
        msg =
          "Google orqali kirish hozircha sozlanmagan. Iltimos, pastdagi Email va Parol orqali ro‘yxatdan o‘ting.";
      }
      setErrorMsg(msg);
      if (onToast) onToast(msg, true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");

    const cleanEmail = email.trim();
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanPass) {
      setErrorMsg("Iltimos, email va parolni kiriting.");
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMsg("Parol kamida 6 ta belgidan iborat bo‘lishi kerak.");
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error("Tizim ulanishi sozlanmagan.");
      }

      if (mode === "register") {
        const data = await signUpWithEmail(cleanEmail, cleanPass, fullName.trim());

        // Agar avtomatik tasdiqlangan bo'lsa (autoconfirm on)
        if (data?.session?.user) {
          if (onToast) onToast("Ro‘yxatdan muvaffaqiyatli o‘tdingiz! 🚀");
          if (onAuthSuccess) onAuthSuccess(data.session.user);
          return;
        }

        // Tasdiqlash xabari emailingizga ketgan bo'lsa -> Gmail holatiga o'tamiz
        setRegisteredEmail(cleanEmail);
        setAwaitingEmailConfirm(true);
        setResendCooldown(60);
        if (onToast) onToast("Tasdiqlash havolasi emailingizga yuborildi! ✉️");
      } else {
        // Login rejimi
        const data = await signInWithEmail(cleanEmail, cleanPass);
        if (data?.user) {
          if (onToast) onToast("Xush kelibsiz! 👋");
          if (onAuthSuccess) onAuthSuccess(data.user);
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      let msg = err.message || "Xatolik yuz berdi.";
      if (msg.includes("Invalid login credentials")) {
        msg = "Email yoki parol noto‘g‘ri. Qayta tekshirib ko‘ring.";
      } else if (msg.includes("User already registered")) {
        msg = "Bu email bilan allaqachon ro‘yxatdan o‘tilgan. 'Kirish' bo‘limiga o‘ting.";
      } else if (msg.includes("Email not confirmed")) {
        setRegisteredEmail(cleanEmail);
        setAwaitingEmailConfirm(true);
        msg = "Email tasdiqlanmagan. Iltimos, pochtangizdagi xatni tekshiring.";
      }
      setErrorMsg(msg);
      if (onToast) onToast(msg, true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGmail = () => {
    const isTelegram = Boolean(window.Telegram?.WebApp);
    const gmailUrl = "https://mail.google.com";

    if (isTelegram && window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(gmailUrl);
    } else {
      window.open(gmailUrl, "_blank");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setErrorMsg("Iltimos, xatdagi kodni kiriting.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const data = await verifyEmailOtp(registeredEmail, otpCode.trim());
      if (data?.session?.user) {
        if (onToast) onToast("Email tasdiqlandi! Xush kelibsiz! 🎉");
        if (onAuthSuccess) onAuthSuccess(data.session.user);
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setErrorMsg("Tasdiqlash kodi noto‘g‘ri yoki muddati o‘tgan.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await resendVerificationEmail(registeredEmail);
      setResendCooldown(60);
      setInfoMsg("Yangi tasdiqlash xabari emailingizga yuborildi!");
      if (onToast) onToast("Xabar qayta yuborildi! ✉️");
    } catch (err) {
      console.error("Resend error:", err);
      setErrorMsg(err.message || "Qayta yuborishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100%",
        padding: "24px 18px",
        boxSizing: "border-box",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "var(--card)",
          borderRadius: "28px",
          border: "2.5px solid var(--edge)",
          boxShadow: "0 8px 0 var(--edge)",
          padding: "24px 20px",
          boxSizing: "border-box",
          animation: "scr 0.3s ease-out",
        }}
      >
        {/* ============================================================== */}
        {/* 1. GMAIL TASDIQLASH HOLATI (Foydalanuvchi akkaunt ochgandan so'ng) */}
        {/* ============================================================== */}
        {awaitingEmailConfirm ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div
                style={{
                  width: "74px",
                  height: "74px",
                  borderRadius: "24px",
                  background: "#eff6ff",
                  border: "2.5px solid #93c5fd",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "36px",
                  marginBottom: "12px",
                  boxShadow: "0 6px 16px rgba(59, 130, 246, 0.15)",
                }}
              >
                ✉️
              </div>
              <h2
                className="disp"
                style={{
                  fontSize: "22px",
                  margin: "0 0 6px 0",
                  color: "var(--fg)",
                  fontWeight: "900",
                }}
              >
                Pochtangizni tekshiring!
              </h2>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: 1.45,
                  color: "var(--muted)",
                  margin: 0,
                }}
              >
                Akkauntni faollashtirish havolasi quyidagi email manziliga yuborildi:
              </p>
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px 12px",
                  background: "rgba(0, 0, 0, 0.05)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "800",
                  color: "var(--fg)",
                  wordBreak: "break-all",
                }}
              >
                {registeredEmail}
              </div>
            </div>

            {/* Direct Gmail Open Button */}
            <button
              type="button"
              onClick={handleOpenGmail}
              style={{
                width: "100%",
                padding: "14px 16px",
                background: "#ea4335",
                color: "#ffffff",
                border: "2.5px solid var(--edge)",
                borderRadius: "16px",
                boxShadow: "0 4px 0 var(--edge)",
                fontSize: "15.5px",
                fontWeight: "900",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "14px",
                transition: "transform 0.1s ease",
              }}
            >
              <span>Gmail ilovasiga o‘tish</span>
              <span style={{ fontSize: "18px" }}>📬</span>
            </button>

            {/* Alert messages */}
            {errorMsg && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#fee2e2",
                  border: "1.5px solid #ef4444",
                  borderRadius: "12px",
                  color: "#991b1b",
                  fontSize: "13px",
                  lineHeight: 1.4,
                  marginBottom: "12px",
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#dcfce7",
                  border: "1.5px solid #22c55e",
                  borderRadius: "12px",
                  color: "#166534",
                  fontSize: "13px",
                  lineHeight: 1.4,
                  marginBottom: "12px",
                }}
              >
                ✅ {infoMsg}
              </div>
            )}

            {/* Optional 6-digit verification code input */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.03)",
                border: "1.5px dashed var(--edge)",
                borderRadius: "14px",
                padding: "12px",
                marginBottom: "14px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--muted)",
                  marginBottom: "8px",
                  textAlign: "center",
                }}
              >
                Yoki xatdagi 6 xonali tasdiqlash kodini kiriting:
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    textAlign: "center",
                    letterSpacing: "4px",
                    fontSize: "17px",
                    fontWeight: "800",
                    borderRadius: "12px",
                    border: "2px solid var(--edge)",
                    background: "var(--card)",
                    color: "var(--fg)",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || !otpCode.trim()}
                  style={{
                    padding: "10px 16px",
                    background: "var(--tang, #ff5722)",
                    color: "#ffffff",
                    fontWeight: "800",
                    fontSize: "13.5px",
                    borderRadius: "12px",
                    border: "2px solid var(--edge)",
                    boxShadow: "0 3px 0 var(--edge)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Tasdiqlash
                </button>
              </div>
            </div>

            {/* Footer controls: Resend & Change Email */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "10px",
                borderTop: "1.5px solid var(--edge)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setAwaitingEmailConfirm(false);
                  setErrorMsg("");
                  setInfoMsg("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                ← Boshqa email
              </button>

              <button
                type="button"
                onClick={handleResendEmail}
                disabled={loading || resendCooldown > 0}
                style={{
                  background: "none",
                  border: "none",
                  color: resendCooldown > 0 ? "var(--muted)" : "var(--cobalt, #2563eb)",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: resendCooldown > 0 ? "default" : "pointer",
                  padding: "4px 0",
                }}
              >
                {resendCooldown > 0
                  ? `Qayta yuborish (${resendCooldown}s)`
                  : "Qayta yuborish 🔄"}
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* 2. ASOSIY RO'YXATDAN O'TISH / KIRISH FORMASI                   */
          /* ============================================================== */
          <div>
            {/* Logo and Brand */}
            <div style={{ textAlign: "center", marginBottom: "18px" }}>
              <div
                style={{
                  display: "inline-block",
                  transform: "scale(1.15)",
                  marginBottom: "4px",
                }}
              >
                <Icon3D name="crown" size={48} />
              </div>
              <h1
                className="disp"
                style={{
                  fontSize: "30px",
                  margin: "6px 0 2px",
                  color: "var(--fg)",
                  letterSpacing: "-0.5px",
                }}
              >
                Birdan<i>!</i>
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "var(--muted)",
                }}
              >
                IELTS Speaking AI Murabbiyi
              </p>
            </div>

            {/* Tab Switcher (Ro'yxatdan o'tish DEFAULT holatda!) */}
            <div
              style={{
                display: "flex",
                background: "rgba(0, 0, 0, 0.06)",
                border: "2px solid var(--edge)",
                borderRadius: "14px",
                padding: "3px",
                marginBottom: "16px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMsg("");
                  setInfoMsg("");
                }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: "10px",
                  border: mode === "register" ? "2px solid var(--edge)" : "none",
                  background: mode === "register" ? "var(--card)" : "transparent",
                  color: mode === "register" ? "var(--fg)" : "var(--muted)",
                  fontWeight: "800",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Ro‘yxatdan o‘tish
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMsg("");
                  setInfoMsg("");
                }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: "10px",
                  border: mode === "login" ? "2px solid var(--edge)" : "none",
                  background: mode === "login" ? "var(--card)" : "transparent",
                  color: mode === "login" ? "var(--fg)" : "var(--muted)",
                  fontWeight: "800",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Kirish
              </button>
            </div>

            {/* Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: "#ffffff",
                color: "#1f2937",
                border: "2.5px solid var(--edge)",
                borderRadius: "14px",
                boxShadow: "0 4px 0 var(--edge)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontSize: "15px",
                fontWeight: "700",
                cursor: "pointer",
                marginBottom: "14px",
                boxSizing: "border-box",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.675-5.17 3.675-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.26v3.15C3.27 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.61H1.26C.46 8.23 0 10.06 0 12s.46 3.77 1.26 5.39l4.01-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.64 1.26 6.61l4.01 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span style={{ color: "#1f2937" }}>Google orqali kirish</span>
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                margin: "12px 0 14px",
                color: "var(--muted)",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1.5px",
                  background: "var(--edge)",
                  opacity: 0.3,
                }}
              />
              <span>yoki email orqali</span>
              <div
                style={{
                  flex: 1,
                  height: "1.5px",
                  background: "var(--edge)",
                  opacity: 0.3,
                }}
              />
            </div>

            {/* Alerts */}
            {errorMsg && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#fee2e2",
                  border: "1.5px solid #ef4444",
                  borderRadius: "12px",
                  color: "#991b1b",
                  fontSize: "13px",
                  lineHeight: 1.4,
                  marginBottom: "14px",
                }}
              >
                ⚠️ {errorMsg}
              </div>
            )}

            {infoMsg && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "#dcfce7",
                  border: "1.5px solid #22c55e",
                  borderRadius: "12px",
                  color: "#166534",
                  fontSize: "13px",
                  lineHeight: 1.4,
                  marginBottom: "14px",
                }}
              >
                ✅ {infoMsg}
              </div>
            )}

            {/* Email & Password Form */}
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {mode === "register" && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: "700",
                      marginBottom: "4px",
                      color: "var(--fg)",
                    }}
                  >
                    Ismingiz
                  </label>
                  <input
                    type="text"
                    placeholder="Masalan: Sardor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      background: "var(--card)",
                      color: "var(--fg)",
                      border: "2px solid var(--edge)",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: "500",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "700",
                    marginBottom: "4px",
                    color: "var(--fg)",
                  }}
                >
                  Gmail yoki elektron pochta
                </label>
                <input
                  type="email"
                  required
                  placeholder="nomingiz@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    background: "var(--card)",
                    color: "var(--fg)",
                    border: "2px solid var(--edge)",
                    borderRadius: "12px",
                    fontSize: "14px",
                    fontWeight: "500",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "700",
                    marginBottom: "4px",
                    color: "var(--fg)",
                  }}
                >
                  Parol
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Kamida 6 ta belgi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 14px",
                      background: "var(--card)",
                      color: "var(--fg)",
                      border: "2px solid var(--edge)",
                      borderRadius: "12px",
                      fontSize: "14px",
                      fontWeight: "500",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "16px",
                      padding: "4px",
                      opacity: 0.7,
                    }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "8px",
                  padding: "14px",
                  background: "var(--tang, #ff5722)",
                  color: "#ffffff",
                  border: "2.5px solid var(--edge)",
                  borderRadius: "14px",
                  boxShadow: "0 4px 0 var(--edge)",
                  fontSize: "16px",
                  fontWeight: "800",
                  cursor: "pointer",
                  transition: "transform 0.1s ease",
                }}
              >
                {loading
                  ? "Kutilmoqda..."
                  : mode === "register"
                  ? "Akkaunt ochish ✨"
                  : "Tizimga kirish 🚀"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
