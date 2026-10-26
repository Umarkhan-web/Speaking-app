from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from faster_whisper import WhisperModel
from pathlib import Path
import tempfile
import os
import re

from analyzer import (
    detect_rule_grammar_errors,
    analyze_vocabulary_distribution,
    compute_comprehensive_scores,
    query_ollama_analysis,
)
from ai_topics import get_ai_topics, generate_custom_topic

app = FastAPI(title="AI Speaking Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

whisper_model = None

def get_whisper():
    global whisper_model
    if whisper_model is None:
        try:
            print("[Whisper] Model yuklanmoqda...")
            whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
            print("[Whisper] Model tayyor!")
        except Exception as e:
            print("[Whisper] Yuklanmadi (Gemini Audio ishlatiladi):", e)
    return whisper_model


class AnalyzeRequest(BaseModel):
    transcript: str
    duration: float = 30.0
    avg_logprob: float = -0.3


class GenerateTopicRequest(BaseModel):
    prompt: str = ""
    level: int = 2


@app.get("/api/health")
def api_health():
    return {"message": "AI Speaking Analyzer ishlayapti!"}


@app.get("/api/topics")
def api_topics(level: int = 2, cat: str = "all", fresh: bool = False):
    topics = get_ai_topics(level=level, category=cat, fresh=fresh)
    return {"success": True, "topics": topics}


@app.post("/api/generate-topic")
def api_generate_topic(req: GenerateTopicRequest):
    topic = generate_custom_topic(req.prompt, req.level)
    return {"success": True, "topic": topic}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    temp_path = None

    try:
        audio = await file.read()

        if not audio:
            raise HTTPException(400, "Audio fayl bo'sh.")

        if len(audio) > 25 * 1024 * 1024:
            raise HTTPException(413, "Audio 25 MB dan kichik bo'lishi kerak.")

        suffix = os.path.splitext(file.filename or "")[1] or ".wav"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp:
            temp.write(audio)
            temp_path = temp.name

        # 1. Faster-whisper with VAD noise filter and accent-priming prompt
        segment_list = []
        info_duration = 0.0
        info_lang = "en"
        avg_logprob = -0.3

        model = get_whisper()
        if model is not None:
            try:
                segments, info = model.transcribe(
                    temp_path,
                    language="en",
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=300, speech_pad_ms=200),
                    initial_prompt="IELTS Speaking candidate response. Spoken in English with potential Central Asian, Uzbek, or international accent. Recognize spoken words verbatim, proper punctuation.",
                )
                segment_list = list(segments)
                info_duration = round(info.duration, 2)
                info_lang = info.language
                if segment_list:
                    avg_logprob = round(sum(s.avg_logprob for s in segment_list) / len(segment_list), 3)
            except Exception as w_err:
                print("[Whisper] STT xatolik (Gemini Audio ishlatiladi):", w_err)

        subtitles = [
            {
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
            }
            for segment in segment_list
            if segment.text.strip()
        ]

        full_transcript = " ".join(item["text"] for item in subtitles).strip()

        # 2. Intelligent Gemini Multimodal Audio Booster:
        # If Whisper missed words due to heavy accent, background noise, or low logprob
        if (len(full_transcript.split()) < 3 and info_duration > 2.5) or avg_logprob < -0.85:
            try:
                from gemini_client import transcribe_audio_with_gemini
                gemini_stt = transcribe_audio_with_gemini(temp_path)
                if gemini_stt and gemini_stt.get("transcript"):
                    gem_text = gemini_stt["transcript"].strip()
                    if len(gem_text.split()) >= len(full_transcript.split()):
                        full_transcript = gem_text
                        gem_subs = gemini_stt.get("subtitles", [])
                        if gem_subs and isinstance(gem_subs, list):
                            subtitles = [
                                {
                                    "start": float(s.get("start", 0.0)),
                                    "end": float(s.get("end", info_duration)),
                                    "text": str(s.get("text", "")).strip(),
                                }
                                for s in gem_subs if str(s.get("text", "")).strip()
                            ]
                        else:
                            subtitles = [{"start": 0.0, "end": info_duration, "text": full_transcript}]
                        avg_logprob = -0.2
                        print(f"[STT Boost] Gemini Multimodal Audio orqali {len(full_transcript.split())} ta so'z olindi!")
            except Exception as g_err:
                print("[Gemini Audio Transcribe] Xatolik:", g_err)

        print(f"\n[STT] Audio: {info_duration:.1f}s | So'zlar soni: {len(full_transcript.split())}")
        print(f"[STT] Matn: \"{full_transcript}\" | Logprob: {avg_logprob}")

        return {
            "success": True,
            "language": info_lang,
            "duration": info_duration,
            "transcript": full_transcript,
            "subtitles": subtitles,
            "avg_logprob": avg_logprob,
        }

    except HTTPException:
        raise
    except Exception as error:
        print("Transcription xatosi:", error)
        raise HTTPException(500, f"Audio tahlilida xatolik: {str(error)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    transcript = request.transcript.strip()
    duration = max(5.0, float(request.duration or 30.0))
    avg_logprob = float(request.avg_logprob if request.avg_logprob is not None else -0.3)

    if not transcript:
        raise HTTPException(400, "Tahlil qilish uchun matn kiriting.")

    if len(transcript) > 10000:
        raise HTTPException(413, "Matn 10000 belgidan oshmasligi kerak.")

    words_list = transcript.split()
    word_count = len(words_list)

    # 1. Very short speech fallback (< 4 words)
    if word_count < 4:
        return {
            "success": True,
            "analysis": {
                "overall_score": 42,
                "estimated_ielts_band": "3.5",
                "vocabulary_level": "A1",
                "fluency_score": 3,
                "fluency_feedback": "Nutq juda qisqa bo'ldi. To'liq baholash uchun kamida 15-30 soniya davomida gapirishga harakat qiling.",
                "scores": {
                    "pronunciation": 50,
                    "grammar": 45,
                    "vocabulary": 40,
                    "fluency": 35,
                    "content": 40,
                },
                "summary": "Nutq juda qisqa bo'lgani sababli to'liq tahlil qilinmadi.",
                "strengths": [
                    "Gapirishni boshlashga jur'at qildingiz.",
                    "So'zlar aniq eshitildi.",
                ],
                "advice": [
                    "Kamida 2-3 ta to'liq gap tuzib, fikringizni batafsilroq ochib bering.",
                    "Tayyorgarlik vaqtida nima demoqchi ekanligingizni rejalashtirib oling.",
                ],
                "coach_tips": [
                    "O'zingizga ishonib, mavzu bo'yicha kamida 15-20 soniya to'xtamasdan gapiring.",
                    "Fikringizni bog'lash uchun 'Because' va 'For example' so'zlaridan foydalaning.",
                ],
                "next_goal": "Keyingi urinishda kamida 15 soniya davomida 3 ta gap ayting.",
                "recommended_connectors": [
                    {"word": "For instance", "meaning": "Masalan", "example": "For instance, I like this topic."},
                    {"word": "Because of this", "meaning": "Shu sababli", "example": "Because of this, I practice daily."},
                ],
                "grammar_errors": [],
                "vocabulary_suggestions": [
                    {"original": transcript, "better": "In my opinion, ...", "meaning": "Mening fikrimcha", "example": f"In my opinion, {transcript} is important."}
                ],
                "improved_answer": f"I would like to share my thoughts on this topic. In my perspective, {transcript}.",
            },
        }

    # 2. Linguistic analysis (Exact grammar rules & CEFR lexicon)
    rule_errors = detect_rule_grammar_errors(transcript)
    vocab_data = analyze_vocabulary_distribution(transcript)
    vocab_level = vocab_data["level"]
    rule_vocab = vocab_data["suggestions"]

    # 3. Query Ollama for AI model answer & contextual insights
    llm_data = query_ollama_analysis(transcript)

    # 4. Merge grammar errors without duplicates
    merged_errors = list(rule_errors)
    seen_errors = {e["original"].lower() for e in rule_errors}

    for err in llm_data.get("grammar_errors", []):
        if isinstance(err, dict) and err.get("original") and err.get("correction"):
            orig = str(err["original"]).strip()
            # Must appear in transcript and not be template placeholder
            if orig.lower() not in seen_errors and orig.lower() in transcript.lower():
                if orig.lower() not in ["xato ibora", "error", "mistake", "wrong phrase"]:
                    seen_errors.add(orig.lower())
                    merged_errors.append({
                        "original": orig,
                        "correction": str(err.get("correction", "")).strip(),
                        "explanation": str(err.get("explanation", "Grammatik moslikka e'tibor qarating.")).strip(),
                    })

    # 5. Prioritize Gemini context-aware vocabulary upgrades, then rule suggestions
    merged_vocab = []
    seen_vocab = set()

    for v in llm_data.get("vocabulary_suggestions", []):
        if isinstance(v, dict) and v.get("better") and v.get("original"):
            orig = str(v["original"]).strip()
            better = str(v["better"]).strip()
            if orig.lower() not in seen_vocab and better.lower() not in ["ielts 7+ muqobili", "advanced"]:
                seen_vocab.add(orig.lower())
                merged_vocab.append({
                    "original": orig,
                    "better": better,
                    "meaning": str(v.get("meaning", "boyroq muqobil")).strip(),
                    "example": str(v.get("example", f"Consider using '{better}' in your speech.")).strip(),
                })

    for v in rule_vocab:
        orig = str(v.get("original", "")).strip()
        better = str(v.get("better", "")).strip()
        if orig.lower() not in seen_vocab:
            seen_vocab.add(orig.lower())
            merged_vocab.append(v)
        if len(merged_vocab) >= 5:
            break

    # If still empty, provide standard high-impact C1 upgrades
    if not merged_vocab:
        merged_vocab = [
            {"original": "good", "better": "exceptional / beneficial", "meaning": "ajoyib, foydali", "example": "It was an exceptional experience."},
            {"original": "important", "better": "crucial / paramount", "meaning": "o'ta muhim", "example": "This is of paramount importance."}
        ]

    # Evaluate CEFR Level (blend algorithmic + Gemini holistic)
    llm_vocab_lvl = str(llm_data.get("vocabulary_level", "")).upper().strip()
    if llm_vocab_lvl in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        # If Gemini detects richer vocabulary in context, upgrade level
        cefr_order = ["A1", "A2", "B1", "B2", "C1", "C2"]
        if cefr_order.index(llm_vocab_lvl) >= cefr_order.index(vocab_level):
            vocab_level = llm_vocab_lvl

    # 6. Compute mathematically consistent IELTS scores
    computed = compute_comprehensive_scores(
        transcript=transcript,
        grammar_errors=merged_errors,
        vocab_level=vocab_level,
        avg_logprob=avg_logprob,
        duration=duration,
    )

    # Blend with Gemini linguistic scoring if provided
    gem_scores = llm_data.get("scores", {})
    if isinstance(gem_scores, dict) and gem_scores.get("grammar"):
        p_sc = round(computed["scores"]["pronunciation"] * 0.45 + float(gem_scores.get("pronunciation", 75)) * 0.55)
        g_sc = round(computed["scores"]["grammar"] * 0.35 + float(gem_scores.get("grammar", 72)) * 0.65)
        v_sc = round(computed["scores"]["vocabulary"] * 0.35 + float(gem_scores.get("vocabulary", 70)) * 0.65)
        f_sc = round(computed["scores"]["fluency"] * 0.45 + float(gem_scores.get("fluency", 70)) * 0.55)
        c_sc = round(float(gem_scores.get("content", computed["scores"]["content"])))
        overall_sc = round((p_sc + g_sc + v_sc + f_sc + c_sc) / 5)

        computed["scores"] = {
            "pronunciation": p_sc,
            "grammar": g_sc,
            "vocabulary": v_sc,
            "fluency": f_sc,
            "content": c_sc,
        }
        computed["overall_score"] = overall_sc

    # Band score
    if llm_data.get("estimated_ielts_band"):
        try:
            gem_band = float(llm_data["estimated_ielts_band"])
            if 3.0 <= gem_band <= 9.0:
                calc_band = float(computed["estimated_ielts_band"])
                blended_band = round(((calc_band + gem_band) / 2) * 2) / 2
                computed["estimated_ielts_band"] = f"{blended_band:.1f}"
        except Exception:
            pass

    # 7. Synthesize personalized strengths & advice from Gemini
    summary = llm_data.get("summary")
    if not summary or "xalqaro" in summary or len(summary) < 15:
        summary = (
            f"Nutqingiz {word_count} ta so'zdan iborat bo'lib, CEFR {vocab_level} darajasida baholandi. "
            f"Asosiy fikringiz tushunarli, ammo {len(merged_errors)} ta grammatik o'rin ustida ishlash tavsiya etiladi."
            if merged_errors
            else f"Nutqingiz {word_count} ta so'zdan iborat bo'lib, toza grammatika va CEFR {vocab_level} darajasi bilan ajralib turadi."
        )

    llm_strengths = llm_data.get("strengths")
    if llm_strengths and isinstance(llm_strengths, list) and len(llm_strengths) >= 2:
        strengths = [str(s).strip() for s in llm_strengths if str(s).strip()]
    else:
        strengths = [
            f"Mavzu bo'yicha {word_count} ta so'z bilan fikringizni ifodalashga harakat qildingiz.",
            "Nutqning asosiy g'oyasi tinglovchiga yetib bordi va tushunarli bo'ldi."
        ]

    llm_advice = llm_data.get("advice")
    if llm_advice and isinstance(llm_advice, list) and len(llm_advice) >= 2:
        advice = [str(a).strip() for a in llm_advice if str(a).strip()]
    elif merged_errors:
        first_err = merged_errors[0]
        advice = [
            f"Grammatikaga diqqat qiling: \"{first_err['original']}\" o'rniga \"{first_err['correction']}\" deyish to'g'ri bo'ladi.",
            f"Lug'at darajangizni {vocab_level} dan oshirish uchun tavsiya etilgan sinonimlardan foydalaning."
        ]
    else:
        advice = [
            "Fikrlaringizni 'Although', 'Furthermore' kabi murakkabroq bog'lovchilar bilan boyiting.",
            "Nutqni yanada qiziqarli qilish uchun shaxsiy hayotingizdan aniq bir misol qo'shing."
        ]

    llm_coach_tips = llm_data.get("coach_tips")
    if llm_coach_tips and isinstance(llm_coach_tips, list) and len(llm_coach_tips) >= 2:
        coach_tips = [str(c).strip() for c in llm_coach_tips if str(c).strip()]
    else:
        coach_tips = [
            "Fikrlaringiz orasida 1-2 soniya xotirjam pauza qilib, nafasni to'g'ri rostlang va shoshilmang.",
            "Nutq uzilib qolmasligi uchun 'Furthermore', 'In particular' yoki 'For instance' bog'lovchilaridan foydalaning."
        ]

    next_goal = llm_data.get("next_goal")
    if not next_goal or "shakllantiruvchi" in str(next_goal).lower() or len(str(next_goal)) < 10:
        next_goal = (
            f"Keyingi mashqda \"{merged_errors[0]['original']}\" kabi xatolarga yo'l qo'ymaslik va kamida bitta C1 darajasidagi so'z ishlatish."
            if merged_errors
            else "Keyingi mashqda 'PREP' formulasidan foydalanib, fikringizni 4 bosqichda to'liq ochib bering."
        )

    improved_answer = llm_data.get("improved_answer")
    if not improved_answer or "complete" in improved_answer.lower() or len(improved_answer.split()) < len(words_list):
        # High quality Band 8+ rewrite based on transcript
        improved_answer = f"I would like to elaborate on this topic. {transcript.capitalize()} In my perspective, this aspect plays a fundamental role in our daily lives, and having a comprehensive understanding of it is truly beneficial."

    connectors = llm_data.get("recommended_connectors")
    if not connectors or len(connectors) < 2:
        connectors = [
            {"word": "Furthermore", "meaning": "Bundan tashqari", "example": "Furthermore, it provides a great deal of convenience."},
            {"word": "For instance", "meaning": "Masalan", "example": "For instance, I frequently encounter this situation."}
        ]

    wpm = round((word_count / (duration / 60)))
    fluency_feedback = f"Nutq sur'ati: daqiqasiga ~{wpm} ta so'z. " + (
        "Sur'at me'yorda va tabiiy eshitiladi." if 90 <= wpm <= 150 else
        "Biroz tez gapirdingiz, shoshilmasdan gapirishga harakat qiling." if wpm > 150 else
        "Sur'at biroz sekin, fikrlarni tezroq jamlash ustida ishlang."
    )

    final_analysis = {
        "overall_score": computed["overall_score"],
        "estimated_ielts_band": computed["estimated_ielts_band"],
        "vocabulary_level": vocab_level,
        "fluency_score": computed["fluency_score"],
        "scores": computed["scores"],
        "summary": summary,
        "strengths": strengths,
        "advice": advice,
        "coach_tips": coach_tips,
        "next_goal": next_goal,
        "recommended_connectors": connectors,
        "grammar_errors": merged_errors,
        "vocabulary_suggestions": merged_vocab,
        "fluency_feedback": fluency_feedback,
        "improved_answer": improved_answer,
    }

    print("\n[AI ANALYZER] Tahlil muvaffaqiyatli yakunlandi:")
    print(f"  - IELTS Band: {final_analysis['estimated_ielts_band']}")
    print(f"  - Vocab Level: {final_analysis['vocabulary_level']}")
    print(f"  - Xatolar soni: {len(merged_errors)}")
    print(f"  - Ballar: {final_analysis['scores']}")

    return {
        "success": True,
        "analysis": final_analysis,
    }


# ==========================================
# Frontend Statik Fayllarini Ulash (Single-Server Fullstack)
# ==========================================
DIST_DIR = Path(__file__).resolve().parent / "dist"
if not DIST_DIR.exists():
    DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    icons_dir = DIST_DIR / "icons3d"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    if icons_dir.exists():
        app.mount("/icons3d", StaticFiles(directory=icons_dir), name="icons3d")

    @app.get("/")
    async def serve_root():
        index_file = DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "AI Speaking Analyzer ishlayapti!"}

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        target = DIST_DIR / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(target)
        index_file = DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"error": "Not Found"}
else:
    @app.get("/")
    def serve_fallback_root():
        return {"message": "AI Speaking Analyzer ishlayapti! (Frontend dist topilmadi)"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

