const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : (typeof window !== "undefined" && window.location.port === "5173"
        ? "http://127.0.0.1:8000"
        : "");

/**
 * Audio faylni Whisper STT orqali matnga aylantirish (/transcribe)
 * @param {Blob} audioBlob - MediaRecorder'dan olingan audio
 * @returns {Promise<{success: boolean, language: string, duration: number, transcript: string, subtitles: Array}>}
 */
export async function transcribeAudio(audioBlob) {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("Audio yozilmadi yoki bo'sh. Qaytadan urinib ko'ring.");
  }

  const formData = new FormData();
  const filename = audioBlob.type && audioBlob.type.includes("wav") ? "recording.wav" : "recording.webm";
  formData.append("file", audioBlob, filename);

  const response = await fetch(`${API_BASE_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Audio-ni matnga aylantirishda backend xatosi yuz berdi.");
  }

  return data;
}

/**
 * Matnni Ollama (qwen2.5:3b) orqali tahlil qilish (/analyze)
 * @param {string} transcript - O'quvchining nutq matni
 * @returns {Promise<{success: boolean, analysis: object}>}
 */
export async function analyzeTranscript(transcript, duration = 30, avgLogprob = -0.3) {
  const text = (transcript || "").trim();
  if (!text) {
    throw new Error("Tahlil qilish uchun nutq matni topilmadi.");
  }

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript: text,
      duration: Number(duration) || 30,
      avg_logprob: Number(avgLogprob) || -0.3,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "AI tahlilini olishda xatolik yuz berdi.");
  }

  return data;
}

/**
 * Backend holatini tekshirish
 */
export async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * AI tomonidan tuzilgan mavzular va savollarni yuklab olish (/api/topics)
 * @param {number} level - Daraja (1, 2 yoki 3)
 * @param {string} category - Kategoriya ('all', 'daily', 'travel', va h.k.)
 * @param {boolean} fresh - Yangi generatsiya qilish
 * @returns {Promise<Array>}
 */
export async function fetchAITopics(level = 2, category = "all", fresh = false) {
  try {
    const url = `${API_BASE_URL}/api/topics?level=${level}&cat=${encodeURIComponent(
      category || "all"
    )}${fresh ? "&fresh=true" : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Mavzularni yuklab bo'lmadi");
    const data = await res.json();
    return data.topics || [];
  } catch (e) {
    console.warn("AI topics fetch error:", e);
    return [];
  }
}

/**
 * Foydalanuvchining shaxsiy mavzusi uchun AI orqali savollar generatsiya qilish (/api/generate-topic)
 * @param {string} prompt - Foydalanuvchi kiritgan mavzu
 * @param {number} level - Daraja
 * @returns {Promise<object|null>}
 */
export async function generateAITopic(prompt, level = 2) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/generate-topic`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, level }),
    });
    if (!res.ok) throw new Error("Mavzu yaratishda xatolik");
    const data = await res.json();
    return data.topic || null;
  } catch (e) {
    console.warn("Generate custom topic error:", e);
    return null;
  }
}

export { API_BASE_URL };
