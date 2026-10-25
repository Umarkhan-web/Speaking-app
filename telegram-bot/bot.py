import asyncio
import logging
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Windows konsolida UTF-8 xatoliklarini oldini olish
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
    MenuButtonWebApp,
)

# .env faylini yuklash
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("telegram_webapp_bot")


def build_inline_keyboard(url: str) -> InlineKeyboardMarkup:
    """Web App ochuvchi inline tugma"""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎙️ IELTS Speaking AI ni ochish",
                    web_app=WebAppInfo(url=url),
                )
            ],
            [
                InlineKeyboardButton(
                    text="ℹ️ Bot haqida",
                    callback_data="about_bot"
                )
            ]
        ]
    )


def build_reply_keyboard(url: str) -> ReplyKeyboardMarkup:
    """Pastdagi doimiy Web App tugmasi"""
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="🚀 Ilovani ochish",
                    web_app=WebAppInfo(url=url),
                )
            ]
        ],
        resize_keyboard=True,
        persistent=True,
    )


dp = Dispatcher()


@dp.message(CommandStart())
async def handle_start(message: types.Message, bot: Bot):
    """Foydalanuvchi /start bosganda ishlaydi"""
    user_name = message.from_user.first_name if message.from_user else "Foydalanuvchi"

    # Telegram chat menyu tugmasini (pastki chap burchak) WebApp qilib sozlash
    try:
        await bot.set_chat_menu_button(
            chat_id=message.chat.id,
            menu_button=MenuButtonWebApp(
                text="Ilova",
                web_app=WebAppInfo(url=WEBAPP_URL),
            )
        )
    except Exception as e:
        logger.warning(f"Menyu tugmasini sozlashda ogohlantirish: {e}")

    welcome_text = (
        f"Assalomu alaykum, <b>{user_name}</b>! 👋\n\n"
        "🎯 <b>IELTS Speaking AI Murabbiyi</b> botiga xush kelibsiz!\n\n"
        "Bu bot orqali siz to'g'ridan-to'g'ri Telegram ichida o'z nutqingizni yozib, "
        "sun'iy intellekt yordamida IELTS Speaking ballaringizni, grammatika va lug'at tahlilini olishingiz mumkin.\n\n"
        "👇 <b>Ilovani ishga tushirish uchun quyidagi tugmani bosing:</b>"
    )

    await message.answer(
        text=welcome_text,
        parse_mode="HTML",
        reply_markup=build_inline_keyboard(WEBAPP_URL),
    )

    # Shuningdek, pastki klaviaturada ham tugma chiqaramiz
    await message.answer(
        "💡 <i>Eslatma: Xabar yozish maydonining yonidagi 'Ilova' menyusi yoki pastdagi tugma orqali istalgan vaqt ilovani ochishingiz mumkin.</i>",
        parse_mode="HTML",
        reply_markup=build_reply_keyboard(WEBAPP_URL),
    )


@dp.message(Command("app"))
async def handle_app_command(message: types.Message):
    """/app buyrug'i berilganda"""
    await message.answer(
        "🚀 <b>Ilovani ochish uchun quyidagi tugmani bosing:</b>",
        parse_mode="HTML",
        reply_markup=build_inline_keyboard(WEBAPP_URL),
    )


@dp.message(Command("help"))
async def handle_help(message: types.Message):
    """/help buyrug'i berilganda"""
    help_text = (
        "📖 <b>Botdan foydalanish bo'yicha qo'llanma:</b>\n\n"
        "1. <b>'IELTS Speaking AI ni ochish'</b> tugmasini bosing.\n"
        "2. Telegram ilovasi ichida veb-ilova (Mini App) ochiladi.\n"
        "3. Berilgan mavzu bo'yicha mikrofon orqali ingliz tilida nutq yozing.\n"
        "4. AI sizning nutqingizni tahlil qilib, IELTS band balli, grammatik xatolar va maslahatlar beradi.\n\n"
        "⚙️ <b>Buyruqlar:</b>\n"
        "• /start - Botni qayta ishga tushirish\n"
        "• /app - Veb ilovani ochish tugmasi\n"
        "• /help - Yordam va ko'rsatmalar"
    )
    await message.answer(help_text, parse_mode="HTML")


@dp.callback_query(F.data == "about_bot")
async def handle_about_callback(callback: types.CallbackQuery):
    """'Bot haqida' tugmasi bosilganda"""
    await callback.answer()
    info_text = (
        "🤖 <b>AI Speaking Analyzer Web App</b>\n\n"
        "Ushbu ilova sun'iy intellekt (Whisper STT + Qwen LLM) asosida ishlaydi.\n"
        "Talabalarga IELTS Speaking imtihoniga tayyorlanishda tezkor va aniq feedback beradi."
    )
    await callback.message.answer(
        info_text,
        parse_mode="HTML",
        reply_markup=build_inline_keyboard(WEBAPP_URL)
    )


async def main():
    if not BOT_TOKEN or BOT_TOKEN == "BOT_TOKEN_SHU_YERGA_YOZILADI":
        print("\n" + "=" * 60)
        print("❌ XATOLIK: BOT_TOKEN ko'rsatilmagan!")
        print("Iltimos, telegram-bot/.env fayliga bot tokeningizni kiriting:")
        print("BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ")
        print("=" * 60 + "\n")
        sys.exit(1)

    if not WEBAPP_URL or WEBAPP_URL == "https://sizning-saytingiz-manzili.uz":
        print("\n" + "=" * 60)
        print("❌ XATOLIK: WEBAPP_URL ko'rsatilmagan!")
        print("Iltimos, telegram-bot/.env fayliga saytingiz HTTPS manzilini kiriting:")
        print("WEBAPP_URL=https://...")
        print("=" * 60 + "\n")
        sys.exit(1)

    if not WEBAPP_URL.startswith("https://"):
        print("\n" + "=" * 60)
        print("⚠️ OGOHLANTIRISH: Telegram Web App faqat HTTPS manzillarni qabul qiladi!")
        print(f"Joriy URL: {WEBAPP_URL}")
        print("Lokal test uchun ngrok yoki Cloudflare Tunnel orqali HTTPS havola oling.")
        print("=" * 60 + "\n")

    bot = Bot(token=BOT_TOKEN)

    print("\n" + "=" * 60)
    print("🤖 Telegram bot ishga tushmoqda...")
    print(f"🔗 Web App URL: {WEBAPP_URL}")
    print("=" * 60)

    try:
        # Eski keshdagi webhooklarni o'chirish
        await bot.delete_webhook(drop_pending_updates=True)
        # Polling boshlash
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
