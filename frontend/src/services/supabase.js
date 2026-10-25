import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project") &&
  !supabaseAnonKey.includes("your-anon-key")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Google akkaunt orqali tizimga kirish (OAuth)
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Supabase URL yoki Anon Key hali kiritilmagan. Iltimos, .env faylida VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY ni sozlang."
    );
  }

  const isTelegram = Boolean(window.Telegram?.WebApp?.initData);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      skipBrowserRedirect: isTelegram,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) throw error;

  if (isTelegram && data?.url) {
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(data.url);
    } else {
      window.location.href = data.url;
    }
  }

  return data;
}

/**
 * Email OTP kodini tasdiqlash
 */
export async function verifyEmailOtp(email, token) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase ulanishi sozlanmagan.");
  }
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: "signup",
  });
  if (error) throw error;
  return data;
}

/**
 * Tasdiqlash xatini qayta yuborish
 */
export async function resendVerificationEmail(email) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase ulanishi sozlanmagan.");
  }
  const { data, error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
  });
  if (error) throw error;
  return data;
}

/**
 * Email va parol orqali ro'yxatdan o'tish
 */
export async function signUpWithEmail(email, password, fullName = "") {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase ulanishi sozlanmagan.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Email va parol orqali tizimga kirish
 */
export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase ulanishi sozlanmagan.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Tizimdan chiqish
 */
export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Foydalanuvchi profilini Supabase bilan sinxronizatsiya qilish
 */
export async function syncUserProfile(user, appState) {
  if (!isSupabaseConfigured || !supabase || !user) return;

  try {
    const profileData = {
      id: user.id,
      email: user.email,
      name: appState?.p?.name || user.user_metadata?.full_name || user.email.split("@")[0],
      avatar_url: user.user_metadata?.avatar_url || "",
      xp: appState?.xp || 0,
      level: appState?.p?.level || 2,
      target_band: appState?.p?.goal || 1,
      settings: appState?.p || {},
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (error) {
      console.warn("[Supabase] Profilni saqlashda ogohlantirish:", error.message);
    }
  } catch (e) {
    console.warn("[Supabase] Profil sync xatosi:", e);
  }
}

/**
 * Mashq natijasini (Speaking Session) Supabase ga saqlash
 */
export async function saveSpeakingSessionToSupabase(user, sessionData) {
  if (!isSupabaseConfigured || !supabase || !user || !sessionData) return null;

  try {
    const payload = {
      user_id: user.id,
      topic_en: sessionData.topic?.en || "Unknown Topic",
      topic_uz: sessionData.topic?.uz || "",
      duration: sessionData.duration || 0,
      transcript: sessionData.transcript || "",
      overall_score: sessionData.overall_score || 0,
      ielts_band: sessionData.estimated_ielts_band || "6.0",
      vocabulary_level: sessionData.vocabulary_level || "B2",
      fluency_score: sessionData.fluency_score || 5,
      scores: sessionData.scores || {},
      grammar_errors: sessionData.grammar_errors || [],
      vocabulary_suggestions: sessionData.vocabulary_suggestions || [],
      summary: sessionData.summary || "",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("speaking_sessions")
      .insert([payload])
      .select();

    if (error) {
      console.warn("[Supabase] Mashqni saqlashda xatolik:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("[Supabase] Mashqni saqlashda istisno:", err);
    return null;
  }
}

/**
 * Foydalanuvchining barcha mashqlarini Supabase dan yuklab olish
 */
export async function fetchUserSpeakingSessions(user) {
  if (!isSupabaseConfigured || !supabase || !user) return [];

  try {
    const { data, error } = await supabase
      .from("speaking_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("[Supabase] Mashqlarni yuklab olishda xatolik:", err);
    return [];
  }
}

/**
 * Saqlangan so'zlarni Supabase ga yozish
 */
export async function saveVocabToSupabase(user, wordItem) {
  if (!isSupabaseConfigured || !supabase || !user || !wordItem) return;

  try {
    const payload = {
      user_id: user.id,
      word: wordItem.en,
      meaning: wordItem.uz || "",
      example: wordItem.ex || "",
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("vocab_notebook")
      .upsert(payload, { onConflict: "user_id, word" });

    if (error) {
      console.warn("[Supabase] So'zni saqlashda xatolik:", error.message);
    }
  } catch (e) {
    console.warn("[Supabase] Vocab sync xatosi:", e);
  }
}

/**
 * Saqlangan so'zlarni Supabase dan yuklab olish
 */
export async function fetchUserVocab(user) {
  if (!isSupabaseConfigured || !supabase || !user) return [];

  try {
    const { data, error } = await supabase
      .from("vocab_notebook")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => ({
      en: row.word,
      uz: row.meaning,
      ex: row.example,
    }));
  } catch (e) {
    console.warn("[Supabase] Vocab yuklashda xatolik:", e);
    return [];
  }
}
