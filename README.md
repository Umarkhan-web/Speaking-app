# Birdan! — IELTS Speaking AI Murabbiyi 🎙️

**Birdan!** — bu foydalanuvchilarga ingliz tilida erkin va to‘g‘ri gapirishni o‘rgatuvchi, nutqni sun'iy intellekt (Gemini AI va Whisper STT) orqali chuqur tahlil qilib, IELTS Speaking band ballari, grammatik xatolar tahlili va Band 8.5+ tavsiyalar beruvchi to‘liq veb va Telegram Mini App platformasi.

---

## 🌟 Asosiy Imkoniyatlar

- **Onboarding Preview:** Ilova haqida to‘liq ekranli 3D tushuntirish va taqdimot slaydlari.
- **Jonli Nutq Yozish va Tahlil:** Mikrofon orqali nutqni yozib olish, avtomatik shovqinni filtrlash (VAD) va matnga aylantirish (Faster-Whisper).
- **Gemini AI Ekspert Tahlili:** O‘zbek tilida grammatik xatolar izohi, C1/C2 darajasidagi boy lug‘at tavsiyalari va model javoblar.
- **Supabase Cloud Sync:** Shaxsiy profil, mashqlar tarixi, lug‘at daftarchasi va medallarni bulutda saqlash.
- **Telegram Mini App Integratsiyasi:** Telegram ichida to‘liq ekranli Web App sifatida ishlash (`@birdanbot`).

---

## 📁 Loyiha Strukturasi

```tree
Ai whea/
├── frontend/             # React (Vite) Single Page Application
│   ├── src/              # Komponentlar, sahifalar va xizmatlar
│   ├── public/           # Rasmlar, ikonlar va resurslar
│   └── package.json
├── speaking-analyzer/    # Python FastAPI AI Backend
│   ├── main.py           # API endpointlar (/transcribe, /analyze, /api/topics)
│   ├── analyzer.py       # Lingvistik va IELTS baholash algoritmi
│   ├── gemini_client.py  # Google Gemini 3.5 Flash integratsiyasi
│   └── requirements.txt
├── telegram-bot/         # Telegram WebApp Bot (Aiogram 3.x)
│   ├── bot.py            # Bot logikasi va menyu sozlamalari
│   └── run_bot.bat
└── supabase_setup.sql    # Ma'lumotlar bazasi jadvali va xavfsizlik qoidalari
```

---

## 🚀 Ishga Tushirish Qo‘llanmasi

### 1. Frontend:
```bash
cd frontend
npm install
npm run dev
```

### 2. Backend (FastAPI):
```bash
cd speaking-analyzer
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Telegram Bot:
```bash
cd telegram-bot
python bot.py
```

---

## 🔒 Xavfsizlik va Maxfiylik
Barcha shaxsiy kalitlar (`.env`) `.gitignore` ga kiritilgan. Ishga tushirishdan oldin `.env.example` namunalaridan nusxa olib, `.env` fayllarini to‘ldiring.
