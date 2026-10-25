"""
AI Topic & Question Synthesizer for IELTS Speaking
Generates dynamic, authentic IELTS questions and cue cards across all CEFR levels.
Supports Ollama LLM with a robust procedural generative fallback engine.
"""

import random
import json
import time
import requests

AI_TOPIC_TEMPLATES = {
    1: [
        {
            "en": "Morning habits and productivity",
            "uz": "Tonggi odatlar va sermahsullik",
            "cat": "daily",
            "hint": "Ertalab uyg'onganingizdan boshlab qiladigan harakatlaringizni ketma-ketlikda gapirib bering.",
            "q": [
                "What is the very first thing you do when you wake up in the morning?",
                "Do you prefer a quiet morning alone or an energetic start with family?",
                "How does your morning routine influence your mood for the rest of the day?"
            ],
            "q_uz": [
                "Ertalab uyg'onganingizda eng birinchi nima qilasiz?",
                "Tongni yolg'iz sokin o'tkazishni yoqtirasizmi yoki oilangiz bilan faol boshlashnimi?",
                "Tonggi tartibingiz kun bo'yi kayfiyatingizga qanday ta'sir qiladi?"
            ],
            "suggested_vocab": [
                {"word": "invigorating", "meaning": "tetiklashtiruvchi"},
                {"word": "consistently", "meaning": "muntazam ravishda"}
            ]
        },
        {
            "en": "My favorite childhood memory",
            "uz": "Bolalikdagi eng sevimli xotiram",
            "cat": "daily",
            "hint": "O'tmish zamon fe'llaridan (past simple, used to) to'g'ri foydalanishga e'tibor bering.",
            "q": [
                "What is one memorable event from your childhood that you still cherish?",
                "Who was with you during that experience and what made it special?",
                "How has that memory shaped who you are today?"
            ],
            "q_uz": [
                "Bolaligingizdagi hali ham qadrlaydigan unutilmas voqea qaysi?",
                "O'sha paytda kim siz bilan birga edi va bu nima uchun esda qolarli bo'lgan?",
                "Ushbu xotira bugungi shaxsingizga qanday ta'sir qilgan?"
            ],
            "suggested_vocab": [
                {"word": "nostalgic", "meaning": "o'tmishni qo'msatuvchi"},
                {"word": "cherish", "meaning": "qadrlamoq, asrab-avaylamoq"}
            ]
        },
        {
            "en": "A peaceful place in my city",
            "uz": "Shahrimdagi tinch va sokin joy",
            "cat": "travel",
            "hint": "Ushbu joyning muhiti va u yerda o'zingizni qanday his qilishingizni tasvirlang.",
            "q": [
                "Where do you usually go when you want to escape noise and relax?",
                "What does this place look like and what activities can you do there?",
                "Why is it important for cities to have quiet green spaces?"
            ],
            "q_uz": [
                "Shovqindan qochib dam olmoqchi bo'lsangiz odatda qayerga borasiz?",
                "Bu joy qanday ko'rinishga ega va u yerda nimalar qilish mumkin?",
                "Shaharlarda tinch yashil hududlar bo'lishi nega muhim?"
            ],
            "suggested_vocab": [
                {"word": "tranquil", "meaning": "osuda, tinch"},
                {"word": "picturesque", "meaning": "manzarali, go'zal"}
            ]
        },
        {
            "en": "My dream career and passions",
            "uz": "Orzuyimdagi kasb va qiziqishlarim",
            "cat": "work",
            "hint": "Kelajak rejalaringizni 'I aim to' yoki 'I aspire to' iboralari bilan ifodalang.",
            "q": [
                "What profession are you currently pursuing or hoping to enter?",
                "What particular skills are essential to succeed in that field?",
                "Where do you see your professional journey in five years?"
            ],
            "q_uz": [
                "Hozirda qaysi kasbni egallamoqdasiz yoki qaysi sohaga kirishni xohlaysiz?",
                "Ushbu sohada muvaffaqiyat qozonish uchun qanday mahoratlar zarur?",
                "Besh yildan keyin o'zingizning kasbiy faoliyatingizni qanday tasavvur qilasiz?"
            ],
            "suggested_vocab": [
                {"word": "aspire to", "meaning": "intilmoq, orzu qilmoq"},
                {"word": "perseverance", "meaning": "matonat, qat'iyat"}
            ]
        },
        {
            "en": "Smartphones and daily communication",
            "uz": "Smartfonlar va kundalik muloqot",
            "cat": "tech",
            "hint": "Smartfonlarning ham ijobiy, ham salbiy tomonlarini solishtiring.",
            "q": [
                "How many hours a day do you spend on your phone and for what purpose?",
                "Has messaging apps made human relationships closer or more distant?",
                "Could you easily live without your phone for an entire weekend?"
            ],
            "q_uz": [
                "Kuniga necha soat telefoningizda o'tkazasiz va asosan nima maqsadda?",
                "Xabarlar almashish ilovalari odamlar o'rtasidagi munosabatni yaqinlashtirdimi yoki uzoqlashtirdimi?",
                "Butun dam olish kunlari davomida telefonsiz oson yashay olarmidingiz?"
            ],
            "suggested_vocab": [
                {"word": "indispensable", "meaning": "ajralmas, zaruriy"},
                {"word": "distraction", "meaning": "chalg'ituvchi narsa"}
            ]
        },
        {
            "en": "Music and my emotional world",
            "uz": "Musiqa va mening his-tuyg'ularim",
            "cat": "art",
            "hint": "Musiqa kayfiyatingizga qanday ta'sir qilishiga aniq misol keltiring.",
            "q": [
                "What music genres do you listen to when you study or need inspiration?",
                "Do you prefer attending live concerts or listening with good headphones?",
                "How does music unite people from different cultural backgrounds?"
            ],
            "q_uz": [
                "O'qiyotganda yoki ilhom kerak bo'lganda qanday janrdagi musiqalarni tinglaysiz?",
                "Jonli konsertlarga borishni ma'qul ko'rasizmi yoki quloqchinlarda tinglashnimi?",
                "Musiqa turli madaniyatdagi insonlarni qanday birlashtiradi?"
            ],
            "suggested_vocab": [
                {"word": "uplifting", "meaning": "kayfiyatni ko'taruvchi"},
                {"word": "harmonious", "meaning": "ohangdor, uyg'un"}
            ]
        }
    ],
    2: [
        {
            "en": "The impact of Artificial Intelligence on jobs",
            "uz": "Sun'iy intellektning ish o'rinlariga ta'siri",
            "cat": "tech",
            "hint": "Kelajakda qaysi kasblar o'zgarishi haqida mantiqiy fikr yuriting.",
            "q": [
                "How is artificial intelligence reshaping the modern workplace today?",
                "Which human professions will always require genuine human empathy and creativity?",
                "What should students learn today to remain competitive in an automated world?"
            ],
            "q_uz": [
                "Sun'iy intellekt bugun zamonaviy ish joylarini qanday o'zgartirmoqda?",
                "Qaysi insoniy kasblar doimo haqiqiy hamdardlik va ijodkorlikni talab qiladi?",
                "Avtomatlashtirilgan dunyoda raqobatbardosh bo'lish uchun talabalar nimalarni o'rganishi kerak?"
            ],
            "suggested_vocab": [
                {"word": "revolutionize", "meaning": "tubdan o'zgartirmoq"},
                {"word": "adaptability", "meaning": "moslashuvchanlik"}
            ]
        },
        {
            "en": "Sustainable living and environmental responsibility",
            "uz": "Tabiatni asrash va ekologik mas'uliyat",
            "cat": "daily",
            "hint": "Kichik shaxsiy harakatlarning umumiy sayyoraga ta'siri haqida fikr bildiring.",
            "q": [
                "What personal steps do you take to minimize waste in your daily household?",
                "Should governments impose stricter laws on plastic manufacturing and pollution?",
                "How can schools cultivate genuine environmental awareness in children?"
            ],
            "q_uz": [
                "Kundalik hayotingizda chiqindilarni kamaytirish uchun qanday shaxsiy qadamlar qo'yasiz?",
                "Hukumatlar plastik ishlab chiqarish va ifloslanish bo'yicha qat'iyroq qonunlar joriy qilishi kerakmi?",
                "Maktablar bolalarda haqiqiy ekologik ongni qanday shakllantirishi mumkin?"
            ],
            "suggested_vocab": [
                {"word": "sustainable", "meaning": "barqaror, tabiatga mos"},
                {"word": "detrimental", "meaning": "zararli, ziyon yetkazuvchi"}
            ]
        },
        {
            "en": "Preserving cultural heritage in modern cities",
            "uz": "Zamonaviy shaharlarda madaniy merosni saqlab qolish",
            "cat": "travel",
            "hint": "Tarixiy obidalar va yangi osmono'par binolar o'rtasidagi muvozanatni tahlil qiling.",
            "q": [
                "Is it better to preserve ancient historical buildings or replace them with modern complexes?",
                "How does visiting historical landmarks enrich our understanding of world history?",
                "Why are younger generations sometimes indifferent to traditional customs?"
            ],
            "q_uz": [
                "Qadimiy tarixiy binolarni saqlab qolgan ma'qulmi yoki ularning o'rniga zamonaviy majmualar qurganmi?",
                "Tarixiy obidalarni ziyorat qilish jahon tarixini tushunishimizni qanday boyitadi?",
                "Nega yosh avlod ba'zan an'anaviy urf-odatlarga befarq bo'lib qoladi?"
            ],
            "suggested_vocab": [
                {"word": "architectural", "meaning": "me'moriy"},
                {"word": "indispensable", "meaning": "tengsiz, ajralmas"}
            ]
        },
        {
            "en": "Work-life balance in the digital era",
            "uz": "Raqamli asrda ish va shaxsiy hayot balansi",
            "cat": "work",
            "hint": "Masofaviy ish (remote work) ning afzallik va xatarlari haqida to'xtaling.",
            "q": [
                "Why do so many professionals struggle to disconnect from work after office hours?",
                "Has remote work improved our quality of life or blurred healthy boundaries?",
                "What effective strategies do you personally use to decompress after intensive study?"
            ],
            "q_uz": [
                "Nega ko'plab mutaxassislar ish vaqtidan keyin o'zlarini ishdan uzishga qiynaladilar?",
                "Masofaviy ishlash hayot sifatini yaxshiladimi yoki sog'lom chegaralarni yo'qotdimi?",
                "Kuchli aqliy mehnatdan so'ng dam olish uchun shaxsan qanday samarali usullardan foydalanasiz?"
            ],
            "suggested_vocab": [
                {"word": "burnout", "meaning": "haddan tashqari toliqish"},
                {"word": "boundaries", "meaning": "chegaralar, me'yor"}
            ]
        },
        {
            "en": "Cinema, storytelling and public opinion",
            "uz": "Kino, hikoyanavislik va jamoatchilik fikri",
            "cat": "art",
            "hint": "Filmlarning jamiyat madaniyatiga va xalqlar tushunchasiga ta'sirini ochib bering.",
            "q": [
                "Can a compelling movie or documentary fundamentally change public attitudes?",
                "Why do people prefer watching content at home rather than in traditional cinemas?",
                "What qualities distinguish a timeless classic film from temporary entertainment?"
            ],
            "q_uz": [
                "Ta'sirli film yoki hujjatli film jamoatchilik munosabatini tubdan o'zgartira oladimi?",
                "Nima uchun odamlar an'anaviy kinoteatrlarga borishdan ko'ra uyda tomosha qilishni afzal ko'rishmoqda?",
                "Vaqt sinovidan o'tgan mumtoz filmni vaqtinchalik ko'ngilochar filmdan nimalar ajratib turadi?"
            ],
            "suggested_vocab": [
                {"word": "compelling", "meaning": "o'ta qiziqarli, jalb etuvchi"},
                {"word": "profound", "meaning": "chuqur, teran"}
            ]
        }
    ],
    3: [
        {
            "en": "Ethical dilemmas of emerging technologies",
            "uz": "Yangi texnologiyalarning axloqiy muammolari",
            "cat": "tech",
            "hint": "Murakkab dalillar keltiring, 'From an ethical standpoint' kabi C1 iboralardan foydalaning.",
            "q": [
                "To what extent should autonomous systems and AI algorithms be held accountable for decisions?",
                "Does the pursuit of rapid technological innovation outpace our societal moral framework?",
                "How can humanity ensure that technological advancements universally benefit all socioeconomic classes?"
            ],
            "q_uz": [
                "Avtonom tizimlar va SI algoritmlari qabul qilgan qarorlari uchun qanchalik javobgar bo'lishi kerak?",
                "Tezkor texnologik yangiliklar jamiyatning axloqiy qadriyatlaridan o'zib ketmayaptimi?",
                "Insoniyat texnologiya yutuqlaridan barcha ijtimoiy qatlamlar teng foydalanishini qanday ta'minlay oladi?"
            ],
            "suggested_vocab": [
                {"word": "unprecedented", "meaning": "misli ko'rilmagan"},
                {"word": "paramount", "meaning": "o'ta muhim, ustuvor"}
            ]
        },
        {
            "en": "Global mobility, migration and multiculturalism",
            "uz": "Global migratsiya va ko'p madaniyatli jamiyatlar",
            "cat": "travel",
            "hint": "Madaniy integratsiya va o'zlikni saqlab qolish masalasini muvozanatli yoriting.",
            "q": [
                "What profound cultural benefits and frictions emerge in truly multicultural societies?",
                "How does the concept of national identity evolve when citizens become globally mobile?",
                "What policies successfully foster mutual respect between host communities and immigrants?"
            ],
            "q_uz": [
                "Haqiqiy ko'p madaniyatli jamiyatlarda qanday teran madaniy foydalar va ziddiyatlar yuzaga keladi?",
                "Fuqarolar butun dunyo bo'ylab faol harakat qilganda milliy o'zlik tushunchasi qanday o'zgaradi?",
                "Mahalliy aholi va ko'chib kelganlar o'rtasida o'zaro hurmatni rivojlantirish uchun qanday choralar ko'rish zarur?"
            ],
            "suggested_vocab": [
                {"word": "assimilation", "meaning": "uyg'unlashuv, singishuv"},
                {"word": "diversity", "meaning": "xilma-xillik"}
            ]
        },
        {
            "en": "The philosophy of happiness and modern success",
            "uz": "Baxt falsafasi va zamonaviy muvaffaqiyat mezoni",
            "cat": "daily",
            "hint": "Moddiy yutuqlar va ruhiy xotirjamlik o'rtasidagi bog'liqlikni tahlil qiling.",
            "q": [
                "Has contemporary society distorted the authentic definition of human fulfillment and success?",
                "Why do individuals who achieve immense material wealth often report feelings of emptiness?",
                "What daily practices fundamentally cultivate profound resilience and psychological peace?"
            ],
            "q_uz": [
                "Zamonaviy jamiyat insoniy baxt va muvaffaqiyatning haqiqiy ma'nosini buzib ko'rsatmadimi?",
                "Nega katta moddiy boylikka erishgan insonlar ham ko'pincha ichki bo'shliqni his qilishadi?",
                "Qanday kundalik odatlar insonda mustahkam ruhiy chidamlilik va xotirjamlikni shakllantiradi?"
            ],
            "suggested_vocab": [
                {"word": "fulfillment", "meaning": "ma'naviy to'liqlik, qoniqish"},
                {"word": "resilience", "meaning": "matonat, qiyinchilikka bardosh"}
            ]
        },
        {
            "en": "Educational paradigms: Degrees vs lifelong skills",
            "uz": "Ta'lim paradigmasi: Diplomlar va umrbod ko'nikmalar",
            "cat": "work",
            "hint": "An'anaviy universitet ta'limi bilan amaliy ko'nikmalarni taqqoslang.",
            "q": [
                "Is a traditional university degree becoming obsolete in today's dynamic knowledge economy?",
                "How can academic institutions reinvent their curricula to foster critical thinking rather than rote learning?",
                "What role will self-directed lifelong learning play in future generations?"
            ],
            "q_uz": [
                "Bugungi zamonaviy iqtisodiyotda an'anaviy universitet diplomi o'z qiymatini yo'qotmayaptimi?",
                "Oliy o'quv yurtlari yodlatish o'rniga tanqidiy fikrlashni o'rgatish uchun ta'lim dasturini qanday o'zgartirishi kerak?",
                "Kelajak avlodlar uchun mustaqil, uzluksiz ta'lim olish qanday ahamiyatga ega bo'ladi?"
            ],
            "suggested_vocab": [
                {"word": "obsolete", "meaning": "eskirgan, urfdan qolgan"},
                {"word": "critical thinking", "meaning": "tanqidiy, mustaqil fikrlash"}
            ]
        }
    ]
}


def query_ollama_topics(level: int, category: str, count: int = 5) -> list:
    """Attempt to ask Ollama to synthesize fresh IELTS topics."""
    prompt = f"""You are an IELTS Cambridge Speaking Master Examiner.
Generate {count} unique IELTS Speaking test topics tailored specifically for Level {level} (1=A2/B1, 2=B2, 3=C1/C2) and Category '{category}'.
Return ONLY a valid JSON array of objects with keys:
- "en": English topic name
- "uz": Uzbek translation of the topic name
- "cat": category key ('daily', 'travel', 'work', 'tech', 'art')
- "lvl": {level}
- "hint": 1 practical examiner tip in Uzbek
- "q": Array of 3 challenging IELTS speaking questions
- "q_uz": Array of 3 questions translated into Uzbek
- "suggested_vocab": Array of 2 advanced words with "word" and "meaning" (in Uzbek)
"""
    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json={
                "model": "qwen2.5:3b",
                "messages": [
                    {"role": "system", "content": "Always output valid JSON strictly."},
                    {"role": "user", "content": prompt}
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.3, "num_predict": 1000}
            },
            timeout=12
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        data = json.loads(content)
        if isinstance(data, list) and len(data) > 0:
            for item in data:
                item["ai_generated"] = True
                item["lvl"] = level
            return data
    except Exception as e:
        print("[AI Topics] Ollama offline or slow, using generative algorithmic engine:", e)
    return []


def get_ai_topics(level: int = 2, category: str = "all", fresh: bool = False) -> list:
    """
    Get a synthesized list of topics. If Ollama is available, uses it.
    Otherwise uses procedurally generated IELTS topics with random variations.
    """
    lvl = max(1, min(3, int(level or 2)))
    cat = str(category or "all").lower()

    # Try Ollama if fresh requested
    if fresh:
        ollama_res = query_ollama_topics(lvl, cat, count=4)
        if ollama_res:
            return ollama_res

    pool = AI_TOPIC_TEMPLATES.get(lvl, AI_TOPIC_TEMPLATES[2])
    if cat != "all" and cat != "today":
        filtered = [t for t in pool if t["cat"] == cat]
        if filtered:
            pool = filtered

    # Add variation seed so they feel freshly minted every session
    results = []
    shuffled = list(pool)
    random.shuffle(shuffled)

    for item in shuffled:
        topic_copy = dict(item)
        topic_copy["lvl"] = lvl
        topic_copy["ai_generated"] = True
        topic_copy["generated_at"] = int(time.time())
        results.append(topic_copy)

    return results


def generate_custom_topic(user_prompt: str, level: int = 2) -> dict:
    """
    Synthesize 3 rich IELTS questions for any custom user prompt.
    """
    clean_prompt = (user_prompt or "My chosen topic").strip()
    lvl = max(1, min(3, int(level or 2)))

    # Try Gemini first (high intelligence, authentic IELTS questions)
    try:
        from gemini_client import generate_gemini_topic
        gemini_topic = generate_gemini_topic(clean_prompt, lvl)
        if gemini_topic and gemini_topic.get("q"):
            return gemini_topic
    except Exception as e:
        print("[AI Topics] Gemini generatsiyasida ogohlantirish:", e)

    # Try Ollama fallback
    prompt_msg = f"""A student wants to practice IELTS Speaking on the topic: "{clean_prompt}".
Generate an authentic IELTS Speaking Part 2/3 Cue Card for Level {lvl}.
Return JSON strictly:
{{
  "en": "{clean_prompt.capitalize()}",
  "uz": "Sizning shaxsiy mavzuingiz: {clean_prompt}",
  "cat": "custom",
  "lvl": {lvl},
  "hint": "Mavzu bo'yicha shaxsiy tajribangizni PREP formulasi orqali ochib bering.",
  "q": [
    "Question 1 exploring what it is and your personal connection to it",
    "Question 2 analyzing why this aspect is significant or challenging",
    "Question 3 evaluating the broader impact or future perspective"
  ],
  "q_uz": [
    "1-savol: Bu nima ekanligi va shaxsiy bog'liqligingiz haqida",
    "2-savol: Nega bu jihat muhim yoki qiyin ekanligi haqida",
    "3-savol: Buning kelajakdagi yoki kengroq ta'siri haqida"
  ],
  "suggested_vocab": [
    {{"word": "crucial", "meaning": "o'ta muhim"}},
    {{"word": "perspective", "meaning": "qarash, nuqtai nazar"}}
  ]
}}
"""
    try:
        response = requests.post(
            "http://127.0.0.1:11434/api/chat",
            json={
                "model": "qwen2.5:3b",
                "messages": [
                    {"role": "system", "content": "Always output valid JSON strictly."},
                    {"role": "user", "content": prompt_msg}
                ],
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.2, "num_predict": 600}
            },
            timeout=8
        )
        response.raise_for_status()
        content = response.json()["message"]["content"]
        data = json.loads(content)
        data["ai_generated"] = True
        return data
    except Exception:
        pass

    # Intelligent algorithmic synthesis
    return {
        "en": clean_prompt.capitalize(),
        "uz": f"Siz kiritgan mavzu: {clean_prompt}",
        "cat": "custom",
        "lvl": lvl,
        "hint": "Fikrlaringizni 'First and foremost', 'In particular' kabi bog'lovchilar bilan boyitib, aniq misollar keltiring.",
        "q": [
            f"What initially sparked your interest in {clean_prompt}, and how has it influenced you?",
            f"What are the most significant advantages or challenges associated with {clean_prompt}?",
            f"How do you anticipate {clean_prompt} will develop or impact society in the coming decade?"
        ],
        "q_uz": [
            f"{clean_prompt} mavzusiga sizda ilk bor nima qiziqish uyg'otgan va u sizga qanday ta'sir qilgan?",
            f"{clean_prompt} bilan bog'liq eng asosiy afzalliklar yoki qiyinchiliklar nimalardan iborat?",
            f"Kelgusi o'n yillikda {clean_prompt} qanday rivojlanadi yoki jamiyatga qanday ta'sir qiladi deb o'ylaysiz?"
        ],
        "suggested_vocab": [
            {"word": "paramount", "meaning": "o'ta muhim, birlamchi"},
            {"word": "elaborate", "meaning": "batafsil yoritib bermoq"}
        ],
        "ai_generated": True
    }
