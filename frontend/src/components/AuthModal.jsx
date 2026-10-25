import React, { useState } from "react";
import { Icon3D } from "./Icon3D";
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  isSupabaseConfigured,
} from "../services/supabase";

export function AuthModal({ isOpen, onClose, onAuthSuccess, onToast }) {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          "Supabase API sozlanmagan. Iltimos, .env fayliga VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY ni kiriting."
        );
      }
      await signInWithGoogle();
    } catch (err) {
      console.error("Google sign in error:", err);
      setErrorMsg(err.message || "Google orqali kirishda xatolik yuz berdi.");
      if (onToast) onToast(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Iltimos, email va parolni to'liq kiriting.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Parol kamida 6 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          "Supabase API ulanishi topilmadi. Iltimos, .env faylida VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY ni kiriting."
        );
      }

      if (mode === "register") {
        const { user } = await signUpWithEmail(email, password, fullName);
        if (onToast) onToast("Ro'yxatdan muvaffaqiyatli o'tdingiz!");
        if (onAuthSuccess) onAuthSuccess(user);
        onClose();
      } else {
        const { user } = await signInWithEmail(email, password);
        if (onToast) onToast("Xush kelibsiz!");
        if (onAuthSuccess) onAuthSuccess(user);
        onClose();
      }
    } catch (err) {
      console.error("Auth error:", err);
      let msg = err.message || "Tizimga kirishda xatolik.";
      if (msg.includes("Invalid login credentials")) {
        msg = "Email yoki parol noto'g'ri kiritildi.";
      } else if (msg.includes("User already registered")) {
        msg = "Bu email bilan allaqachon ro'yxatdan o'tilgan.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-box auth-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "420px",
          width: "90%",
          padding: "24px 20px",
          background: "var(--card, #fff)",
          borderRadius: "20px",
          border: "2px solid var(--fg, #111)",
          boxShadow: "6px 6px 0px var(--fg, #111)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "18px" }}>
          <div style={{ display: "inline-flex", marginBottom: "8px" }}>
            <Icon3D name="profile" size={44} />
          </div>
          <h3 className="disp" style={{ margin: "4px 0", fontSize: "1.4rem" }}>
            {mode === "login" ? "Tizimga kirish" : "Ro‘yxatdan o‘tish"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.88rem", opacity: 0.75 }}>
            Mashqlar, IELTS ballar va lug‘atni Supabase bulutida saqlang
          </p>
        </div>

        {/* Configuration Notice if not set yet */}
        {!isSupabaseConfigured && (
          <div
            style={{
              padding: "10px 12px",
              background: "#fff3cd",
              border: "1px solid #ffeeba",
              borderRadius: "10px",
              fontSize: "0.8rem",
              color: "#856404",
              marginBottom: "14px",
              lineHeight: 1.4,
            }}
          >
            ⚠️ <b>Supabase kalitlari kutilmoqda:</b> <code>.env</code> faylida Supabase URL va Anon Key kiritilgach, Google va Supabase bulutiga to'liq ulanadi.
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "#fff",
            border: "2px solid #111",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            fontSize: "0.95rem",
            fontWeight: "600",
            cursor: "pointer",
            boxShadow: "3px 3px 0px #111",
            marginBottom: "14px",
            transition: "all 0.15s ease",
          }}
        >
          {/* Authentic Google Icon */}
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
          <span>Google orqali kirish</span>
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "14px 0",
            gap: "10px",
            color: "#888",
            fontSize: "0.82rem",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "#ddd" }} />
          <span>yoki email orqali</span>
          <div style={{ flex: 1, height: "1px", background: "#ddd" }} />
        </div>

        {/* Mode Switch Tabs */}
        <div
          style={{
            display: "flex",
            background: "#f0f0f0",
            borderRadius: "10px",
            padding: "3px",
            marginBottom: "14px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg("");
            }}
            style={{
              flex: 1,
              padding: "7px 0",
              border: "none",
              borderRadius: "8px",
              background: mode === "login" ? "#fff" : "transparent",
              fontWeight: mode === "login" ? "bold" : "normal",
              boxShadow: mode === "login" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
              fontSize: "0.88rem",
            }}
          >
            Kirish
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setErrorMsg("");
            }}
            style={{
              flex: 1,
              padding: "7px 0",
              border: "none",
              borderRadius: "8px",
              background: mode === "register" ? "#fff" : "transparent",
              fontWeight: mode === "register" ? "bold" : "normal",
              boxShadow: mode === "register" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              cursor: "pointer",
              fontSize: "0.88rem",
            }}
          >
            Ro‘yxatdan o‘tish
          </button>
        </div>

        {/* Error Message Alert */}
        {errorMsg && (
          <div
            style={{
              padding: "8px 10px",
              background: "#fee",
              border: "1px solid #fcc",
              borderRadius: "8px",
              color: "#c00",
              fontSize: "0.84rem",
              marginBottom: "12px",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: "0.82rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
                Ismingiz
              </label>
              <input
                type="text"
                placeholder="Masalan: Sardor"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #333",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
              Elektron pochta
            </label>
            <input
              type="email"
              required
              placeholder="ismingiz@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1.5px solid #333",
                fontSize: "0.9rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.82rem", fontWeight: "600", display: "block", marginBottom: "4px" }}>
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
                  padding: "10px 38px 10px 12px",
                  borderRadius: "10px",
                  border: "1.5px solid #333",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  opacity: 0.6,
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
              padding: "12px",
              borderRadius: "12px",
              background: "var(--cobalt, #2563eb)",
              color: "#fff",
              border: "2px solid #111",
              fontSize: "0.95rem",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "3px 3px 0px #111",
            }}
          >
            {loading ? "Yuklanmoqda..." : mode === "login" ? "Kirish" : "Ro‘yxatdan o‘tish"}
          </button>
        </form>

        {/* Guest Mode / Close */}
        <div style={{ textAlign: "center", marginTop: "14px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: "0.84rem",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Mehmon sifatida davom etish
          </button>
        </div>
      </div>
    </div>
  );
}
