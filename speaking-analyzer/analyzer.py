"""
Deep AI & Linguistic Analyzer for IELTS Speaking
Combines acoustic Whisper metrics, CEFR lexical analysis, grammar checking,
and Ollama LLM contextual evaluation.
"""

import re
import math
import requests
import json

# ==========================================
# 1. CEFR VOCABULARY TIERS & ADVANCED SYNONYMS
# ==========================================

CEFR_TIERS = {
    "C2": {
        "predominantly", "inevitable", "magnificent", "phenomenal", "paradigm",
        "ubiquitous", "meticulous", "comprehensive", "consequently", "indispensable",
        "subsequent", "unprecedented", "deteriorate", "profound", "articulate",
        "exponential", "adversity", "paramount", "impeccable", "pervasive"
    },
    "C1": {
        "revolutionize", "revolutionized", "infrastructure", "picturesque",
        "substantial", "furthermore", "moreover", "illustrate", "crucial",
        "significant", "accomplish", "diverse", "detrimental", "advocate",
        "elaborate", "cultivate", "enhance", "endeavor", "diminish", "bustling",
        "fascinating", "metropolis", "architecture", "landscape", "perspective",
        "exceptional", "fundamental", "sustainable", "feasible", "indifferent",
        "beneficial", "allocate", "fluctuate", "predominant", "sophisticated"
    },
    "B2": {
        "technology", "environment", "communicate", "communication", "instant",
        "immediately", "convenient", "advantage", "disadvantage", "experience",
        "traditional", "opportunity", "attitude", "encourage", "situation",
        "influence", "confidence", "community", "essential", "efficient",
        "challenging", "positive", "negative", "generation", "achievement",
        "cultural", "necessary", "participate", "development", "frequently",
        "approximately", "specifically", "especially", "globally", "delay"
    },
    "B1": {
        "popular", "international", "protect", "decision", "future", "opinion",
        "believe", "prepare", "describe", "prefer", "consider", "benefit",
        "comfortable", "interesting", "important", "problem", "solution",
        "travel", "hobby", "modern", "different", "similar", "activity",
        "education", "health", "history", "society", "natural", "regularly"
    },
    "A2": {
        "city", "car", "people", "park", "live", "living", "beautiful", "visit",
        "building", "family", "friend", "house", "school", "place", "clean",
        "quiet", "busy", "weather", "food", "music", "sport", "game", "money",
        "holiday", "travel", "simple", "easy", "hard", "early", "late"
    }
}

VOCAB_UPGRADES = [
    {
        "targets": ["big", "huge", "large"],
        "better": "vast / sprawling",
        "meaning": "juda ulkan, keng yoyilgan",
        "example": "My hometown is a sprawling metropolis with modern infrastructure."
    },
    {
        "targets": ["beautiful", "nice", "pretty"],
        "better": "picturesque / scenic",
        "meaning": "ko'rkam, manzarali",
        "example": "The city boasts picturesque parks and breathtaking landscapes."
    },
    {
        "targets": ["good", "great"],
        "better": "exceptional / beneficial",
        "meaning": "ajoyib, juda foydali",
        "example": "Living here provides exceptional educational opportunities."
    },
    {
        "targets": ["important"],
        "better": "crucial / paramount",
        "meaning": "o'ta muhim, hal qiluvchi ahamiyatga ega",
        "example": "Daily speaking practice is of paramount importance for fluency."
    },
    {
        "targets": ["like", "love"],
        "better": "be passionate about / thoroughly enjoy",
        "meaning": "juda qiziqmoq, chin dildan zavqlanmoq",
        "example": "I thoroughly enjoy spending time outdoors in recreational parks."
    },
    {
        "targets": ["very", "really"],
        "better": "remarkably / exceedingly",
        "meaning": "favqulodda, benihoya",
        "example": "The local residents are remarkably hospitable."
    },
    {
        "targets": ["bad"],
        "better": "detrimental / unfavorable",
        "meaning": "zararli, noqulay",
        "example": "Traffic congestion has an unfavorable impact on daily commute."
    },
    {
        "targets": ["think"],
        "better": "firmly believe / maintain the view that",
        "meaning": "qat'iy ishonmoq, shu fikrga qo'shilmoq",
        "example": "I firmly believe that technology has revolutionized education."
    },
    {
        "targets": ["interesting"],
        "better": "captivating / intriguing",
        "meaning": "o'ziga maftun etuvchi, qiziqarli",
        "example": "Exploring ancient history is truly captivating."
    },
    {
        "targets": ["many", "a lot of"],
        "better": "an abundance of / a myriad of",
        "meaning": "juda ko'p miqdordagi, behisob",
        "example": "The area features an abundance of historical monuments."
    }
]

# ==========================================
# 2. COMMON GRAMMAR & EFL ERROR DETECTORS
# ==========================================

GRAMMAR_RULES = [
    (
        r"\b(there is|there's)\s+(\d+|many|several|a lot of|lots of|two|three|four|few)\s+([a-z]+s)\b",
        lambda m: (m.group(0), f"there are {m.group(2)} {m.group(3)}", "Ko'plik otlar oldidan 'there is' emas, 'there are' ishlatiladi.")
    ),
    (
        r"\bpeoples\b",
        lambda m: ("peoples", "people", "'People' so'zi o'zi ko'plik ma'nosida (odamlar), shuning uchun unga '-s' qo'shilmaydi.")
    ),
    (
        r"\b(it|he|she)\s+have\b",
        lambda m: (m.group(0), f"{m.group(1)} has", f"Uchinchi shaxs birlikda ({m.group(1)}) 'have' emas, 'has' fe'li ishlatiladi.")
    ),
    (
        r"\b(it|he|she)\s+don't\b",
        lambda m: (m.group(0), f"{m.group(1)} doesn't", f"Uchinchi shaxs birlikda ({m.group(1)}) inkor uchun 'don't' emas, 'doesn't' ishlatiladi.")
    ),
    (
        r"\b(it|he|she)\s+(go|do|like|want|say|know|take|see|come|think|make)\b",
        lambda m: (m.group(0), f"{m.group(1)} {m.group(2)}s", f"Hozirgi zamonda {m.group(1)} olmoshidan keyin fe'lga '-s/es' qo'shimchasi qo'shiladi.")
    ),
    (
        r"\b(i|we|they|you)\s+has\b",
        lambda m: (m.group(0), f"{m.group(1)} have", f"'{m.group(1)}' olmoshi bilan 'has' emas, 'have' ishlatiladi.")
    ),
    (
        r"\bbuyed\b",
        lambda m: ("buyed", "bought", "'Buy' noto'g'ri fe'l bo'lib, o'tgan zamon shakli 'bought' bo'ladi.")
    ),
    (
        r"\bteached\b",
        lambda m: ("teached", "taught", "'Teach' noto'g'ri fe'l bo'lib, o'tgan zamon shakli 'taught' bo'ladi.")
    ),
    (
        r"\bseed\b",
        lambda m: ("seed", "saw", "'See' noto'g'ri fe'l bo'lib, o'tgan zamoni 'saw' bo'ladi.")
    ),
    (
        r"\bgoed\b",
        lambda m: ("goed", "went", "'Go' fe'lining o'tgan zamon shakli 'went' bo'ladi.")
    ),
    (
        r"\b(yesterday|last (?:week|month|year))\s+([a-z]+)\s+(go|buy|see|come|take|make|eat)\b",
        lambda m: (m.group(0), f"{m.group(1)} {m.group(2)} past tense", "O'tgan zamon payt ravishlari bilan fe'lning o'tgan zamon (Past Simple) shakli ishlatiladi.")
    ),
    (
        r"\b([a-z]+s)\s+was\b",
        lambda m: (m.group(0), f"{m.group(1)} were", "Ko'plikdagi otlar bilan o'tgan zamonda 'was' emas, 'were' ishlatiladi.")
    ),
    (
        r"\b(i|he|she|it)\s+were\b",
        lambda m: (m.group(0), f"{m.group(1)} was", f"Birlikdagi '{m.group(1)}' olmoshi bilan 'were' emas, 'was' ishlatiladi.")
    ),
    (
        r"\bwant to tell about\b",
        lambda m: ("want to tell about", "would like to talk about", "'Tell' fe'lidan keyin shaxs kelishi shart (tell you about), shuning uchun 'talk about' ishlatish to'g'riroq.")
    ),
    (
        r"\bi am agree\b",
        lambda m: ("I am agree", "I agree", "'Agree' fe'li bilan 'am' ishlatilmaydi, to'g'ridan-to'g'ri 'I agree' deyiladi.")
    ),
    (
        r"\blisten music\b",
        lambda m: ("listen music", "listen to music", "'Listen' fe'li doimo 'to' predlogi bilan ishlatiladi.")
    ),
    (
        r"\binformations\b",
        lambda m: ("informations", "information", "'Information' sanalmaydigan ot bo'lib, unga '-s' qo'shilmaydi.")
    ),
    (
        r"\badvices\b",
        lambda m: ("advices", "advice / pieces of advice", "'Advice' sanalmaydigan ot, unga '-s' qo'shilmaydi.")
    )
]


def detect_rule_grammar_errors(text: str) -> list:
    errors = []
    seen = set()
    for pattern, handler in GRAMMAR_RULES:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            orig, corr, expl = handler(match)
            if orig.lower() not in seen:
                seen.add(orig.lower())
                errors.append({
                    "original": orig,
                    "correction": corr,
                    "explanation": expl,
                })
    return errors


def analyze_vocabulary_distribution(text: str) -> dict:
    words = re.findall(r"\b[a-zA-Z']+\b", text.lower())
    if not words:
        return {"level": "A1", "count": 0, "suggestions": []}

    level_counts = {lvl: 0 for lvl in ["C2", "C1", "B2", "B1", "A2"]}
    for w in words:
        for lvl, vocab_set in CEFR_TIERS.items():
            if w in vocab_set:
                level_counts[lvl] += 1
                break

    # Determine CEFR level based on word counts and richness
    if level_counts["C2"] >= 2 or level_counts["C1"] >= 3:
        level = "C1"
    elif level_counts["C1"] >= 1 or level_counts["B2"] >= 3:
        level = "B2"
    elif level_counts["B2"] >= 1 or level_counts["B1"] >= 3:
        level = "B1"
    elif len(words) >= 12 or level_counts["A2"] >= 2:
        level = "A2"
    else:
        level = "A1"

    # Find relevant vocabulary upgrades
    suggestions = []
    used_targets = set()
    text_lower = text.lower()
    for item in VOCAB_UPGRADES:
        for target in item["targets"]:
            if re.search(r"\b" + re.escape(target) + r"\b", text_lower) and target not in used_targets:
                used_targets.add(target)
                suggestions.append({
                    "original": target,
                    "better": item["better"],
                    "meaning": item["meaning"],
                    "example": item["example"]
                })
                break
        if len(suggestions) >= 3:
            break

    return {
        "level": level,
        "count": len(words),
        "suggestions": suggestions,
    }


def compute_comprehensive_scores(
    transcript: str,
    grammar_errors: list,
    vocab_level: str,
    avg_logprob: float,
    duration: float
) -> dict:
    words = re.findall(r"\b[a-zA-Z']+\b", transcript.lower())
    word_count = len(words)
    wpm = round((word_count / max(5.0, duration)) * 60)
    err_count = len(grammar_errors)

    # 1. Grammar score & band
    if err_count == 0 and word_count >= 18:
        g_score = 90
        g_band = 7.5
    elif err_count == 0:
        g_score = 80
        g_band = 6.5
    elif err_count <= 2:
        g_score = max(55, 75 - err_count * 8)
        g_band = 5.5
    elif err_count <= 4:
        g_score = max(45, 62 - err_count * 5)
        g_band = 4.5
    else:
        g_score = 40
        g_band = 4.0

    # 2. Vocabulary score & band
    v_map = {
        "C2": (94, 8.5),
        "C1": (86, 7.5),
        "B2": (74, 6.5),
        "B1": (62, 5.5),
        "A2": (50, 4.5),
        "A1": (38, 3.5),
    }
    v_score, v_band = v_map.get(vocab_level.upper(), (52, 5.0))

    # 3. Pronunciation score & band from Whisper acoustic logprob
    if avg_logprob > -0.25:
        p_score = 86
        p_band = 7.5
    elif avg_logprob > -0.45:
        p_score = 76
        p_band = 6.5
    elif avg_logprob > -0.70:
        p_score = 64
        p_band = 5.5
    else:
        p_score = 50
        p_band = 4.5

    # 4. Fluency score & band based on WPM and length
    if wpm >= 115 and word_count >= 25:
        f_score = 85
        f_band = 7.5
    elif wpm >= 85 and word_count >= 15:
        f_score = 72
        f_band = 6.5
    elif wpm >= 60 and word_count >= 10:
        f_score = 60
        f_band = 5.5
    else:
        f_score = 48
        f_band = 4.5

    c_score = round((v_score + f_score) / 2)
    overall_score = round((g_score + v_score + p_score + f_score + c_score) / 5)

    raw_band = (g_band + v_band + p_band + f_band) / 4.0
    ielts_band = str(round(raw_band * 2) / 2)
    fluency_1_to_10 = max(1, min(10, round(f_score / 10)))

    return {
        "overall_score": overall_score,
        "estimated_ielts_band": ielts_band,
        "fluency_score": fluency_1_to_10,
        "scores": {
            "pronunciation": p_score,
            "grammar": g_score,
            "vocabulary": v_score,
            "fluency": f_score,
            "content": c_score,
        },
    }


def query_ollama_analysis(transcript: str) -> dict:
    """
    Query AI Engine (Gemini with Ollama & procedural fallback) for contextual analysis,
    improved model answer, and deeper insights.
    """
    # 1. Try Gemini first (high intelligence, Band 8.5+ model answer, native Uzbek feedback)
    try:
        from gemini_client import query_gemini_analysis
        gemini_res = query_gemini_analysis(transcript)
        if gemini_res and isinstance(gemini_res, dict) and gemini_res.get("improved_answer"):
            return gemini_res
    except Exception as e:
        print("[AI Engine] Gemini tahlilida ogohlantirish:", e)

    # 2. Fallback to local Ollama if available
    prompt = f"""You are an IELTS Speaking Examiner. Analyze this student speech transcript:
"{transcript}"

Task:
1. Detect any grammatical mistakes.
2. Provide a Band 8+ natural rewritten version of this speech in English.
3. Suggest 2 IELTS C1 vocabulary words.
4. Give 2 strengths and 2 pieces of advice in Uzbek.

JSON format:
{{
  "improved_answer": "Complete Band 8+ rewritten speech in English",
  "summary": "Nutq mazmuni haqida 1-2 gap o'zbekcha xulosa",
  "strengths": ["kuchli tomon 1", "kuchli tomon 2"],
  "advice": ["amaliy maslahat 1", "maslahat 2"],
  "coach_tips": ["aniq texnika 1", "aniq texnika 2"],
  "next_goal": "Bitta aniq keyingi maqsad",
  "recommended_connectors": [
    {{"word": "Furthermore", "meaning": "Bundan tashqari", "example": "Furthermore, it helps me learn."}},
    {{"word": "For instance", "meaning": "Masalan", "example": "For instance, I talk to friends."}}
  ],
  "grammar_errors": [
    {{"original": "error from student", "correction": "correction", "explanation": "explanation in Uzbek"}}
  ],
  "vocabulary_suggestions": [
    {{"original": "simple word", "better": "advanced word", "meaning": "Uzbek meaning", "example": "English example"}}
  ]
}}
"""

    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json={
                "model": "qwen2.5:3b",
                "messages": [
                    {"role": "system", "content": "You are a professional IELTS Speaking Examiner. Always output valid JSON strictly."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1,
                    "num_predict": 1200
                }
            },
            timeout=45
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        return json.loads(content)
    except Exception as e:
        print("[Ollama] LLM tahlilida ogohlantirish (fallback ishlatiladi):", e)
        return {}
