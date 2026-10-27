import asyncio
import io
import logging
import os
import sys
import time
import sqlite3
from datetime import datetime
from pathlib import Path
import aiohttp
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardMarkup,
    KeyboardButton,
    WebAppInfo,
    MenuButtonWebApp,
    BufferedInputFile,
)

# SQLite Baza sozlamalari
DB_PATH = Path(__file__).resolve().parent / "bot_data.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_text TEXT,
            sent_count INTEGER,
            failed_count INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def upsert_user(user_id: int, username: str, first_name: str, last_name: str = ""):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = datetime.utcnow().isoformat()
        cursor.execute("""
            INSERT INTO users (user_id, username, first_name, last_name, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username = excluded.username,
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                last_seen = excluded.last_seen
        """, (user_id, username, first_name, last_name or "", now, now))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"upsert_user error: {e}")

def get_stats():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')")
    today_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE datetime(last_seen) >= datetime('now', '-1 day')")
    active_24h = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE datetime(created_at) >= datetime('now', '-7 days')")
    week_users = cursor.fetchone()[0]
    conn.close()
    return {
        "total": total_users,
        "today": today_users,
        "active_24h": active_24h,
        "week": week_users
    }

def get_all_user_ids():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [r[0] for r in rows]

def get_latest_users(limit: int = 10):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT user_id, username, first_name, created_at 
        FROM users 
        ORDER BY created_at DESC 
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return rows

def log_broadcast(text: str, sent: int, failed: int):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO broadcasts (message_text, sent_count, failed_count)
            VALUES (?, ?, ?)
        """, (text[:500], sent, failed))
        conn.commit()
        conn.close()
    except Exception as e:
        logging.error(f"log_broadcast error: {e}")

# Bot sozlamalari
BOT_TOKEN = os.getenv("BOT_TOKEN", "8233271812:AAFbWNMgJzNzKok2Qlp3XAhIO2KQeUE2dHA").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://speaking-app-git-main-khan-d076.vercel.app/").strip()
ADMIN_ID = int(os.getenv("ADMIN_ID", "6094022048"))
RENDER_BACKEND_URL = os.getenv("RENDER_BACKEND_URL", "https://speaking-app-nqdr.onrender.com").strip()

BOT_START_TIME = time.time()
logger = logging.getLogger("telegram_bot_service")
dp = Dispatcher()

class BroadcastState(StatesGroup):
    waiting_for_message = State()

def is_admin(user_id: int) -> bool:
    return user_id == ADMIN_ID

def build_inline_keyboard(url: str) -> InlineKeyboardMarkup:
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

def build_reply_keyboard(url: str, user_id: int) -> ReplyKeyboardMarkup:
    keyboard = [
        [
            KeyboardButton(
                text="🚀 Ilovani ochish",
                web_app=WebAppInfo(url=url),
            )
        ]
    ]
    if is_admin(user_id):
        keyboard.append([KeyboardButton(text="👑 Admin Panel")])

    return ReplyKeyboardMarkup(
        keyboard=keyboard,
        resize_keyboard=True,
        persistent=True,
    )

def build_admin_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📊 Batafsil Statistika", callback_data="admin_stats"),
                InlineKeyboardButton(text="📢 Xabarnoma (Broadcast)", callback_data="admin_broadcast"),
            ],
            [
                InlineKeyboardButton(text="👥 Oxirgi A'zolar", callback_data="admin_users"),
                InlineKeyboardButton(text="🌐 Serverlar Holati", callback_data="admin_servers"),
            ],
            [
                InlineKeyboardButton(text="📥 Foydalanuvchilar (CSV)", callback_data="admin_export"),
                InlineKeyboardButton(text="🔄 Yangilash", callback_data="admin_refresh"),
            ],
            [
                InlineKeyboardButton(text="🚀 Ilovaga O'tish", web_app=WebAppInfo(url=WEBAPP_URL)),
            ]
        ]
    )

def format_uptime() -> str:
    elapsed = int(time.time() - BOT_START_TIME)
    days, rem = divmod(elapsed, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)
    if days > 0:
        return f"{days} kun, {hours} soat, {minutes} daq"
    elif hours > 0:
        return f"{hours} soat, {minutes} daq"
    return f"{minutes} daqiqa, {seconds} soniya"

async def check_url_health(url: str, timeout_sec: int = 4) -> tuple[bool, int, float]:
    start_t = time.time()
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout_sec)) as resp:
                latency = round((time.time() - start_t) * 1000, 1)
                return (resp.status == 200, resp.status, latency)
    except Exception:
        latency = round((time.time() - start_t) * 1000, 1)
        return (False, 0, latency)

@dp.message(CommandStart())
async def handle_start(message: types.Message, bot: Bot):
    user = message.from_user
    if user:
        upsert_user(
            user_id=user.id,
            username=user.username or "",
            first_name=user.first_name or "",
            last_name=user.last_name or ""
        )

    user_name = user.first_name if user else "Foydalanuvchi"

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

    hint_text = (
        "💡 <i>Eslatma: Xabar yozish maydonining yonidagi 'Ilova' menyusi yoki pastdagi tugma orqali istalgan vaqt ilovani ochishingiz mumkin.</i>"
    )
    if user and is_admin(user.id):
        hint_text += "\n\n👑 <b>Salom Administrator!</b> Siz uchun pastki klaviaturada <b>Admin Panel</b> tugmasi biriktirildi."

    await message.answer(
        hint_text,
        parse_mode="HTML",
        reply_markup=build_reply_keyboard(WEBAPP_URL, user.id if user else 0),
    )

@dp.message(F.text == "👑 Admin Panel")
@dp.message(Command("admin"))
async def handle_admin_panel(message: types.Message):
    if not message.from_user or not is_admin(message.from_user.id):
        await message.answer("⛔ <b>Kechirasiz, bu bo'lim faqat bot administratori uchun!</b>", parse_mode="HTML")
        return

    stats = get_stats()
    text = (
        "👑 <b>BOSHQARUV PANELI (ADMIN DASHBOARD)</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"👤 <b>Admin:</b> <code>{message.from_user.id}</code>\n"
        f"⏱ <b>Bot ishlash vaqti:</b> {format_uptime()}\n\n"
        "📊 <b>Qisqacha Statistika:</b>\n"
        f"• 👥 Jami a'zolar: <b>{stats['total']} ta</b>\n"
        f"• ⚡ Bugun qo'shilgan: <b>+{stats['today']} ta</b>\n"
        f"• 📈 Faol (oxirgi 24s): <b>{stats['active_24h']} ta</b>\n"
        f"• 🗓 Oxirgi 7 kunda: <b>+{stats['week']} ta</b>\n\n"
        "👇 <i>Kerakli amalni tanlang:</i>"
    )
    await message.answer(text, parse_mode="HTML", reply_markup=build_admin_keyboard())

@dp.callback_query(F.data == "admin_refresh")
@dp.callback_query(F.data == "admin_stats")
async def callback_admin_stats(callback: types.CallbackQuery):
    if not callback.from_user or not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat berilmagan!", show_alert=True)
        return

    await callback.answer("Statistika yangilandi 🔄")
    stats = get_stats()
    text = (
        "📊 <b>TO'LIQ STATISTIKA VA KO'RSATKICHLAR</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"👥 <b>Jami foydalanuvchilar:</b> <code>{stats['total']}</code> ta\n"
        f"⚡ <b>Bugun kirganlar:</b> <code>+{stats['today']}</code> ta\n"
        f"📈 <b>24 soat ichida faol:</b> <code>{stats['active_24h']}</code> ta\n"
        f"🗓 <b>Haftalik o'sish:</b> <code>+{stats['week']}</code> ta\n"
        f"🕒 <b>Bot Uptime:</b> {format_uptime()}\n"
        f"📅 <b>Sana:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "✅ Barcha ma'lumotlar real vaqtda bazadan hisoblandi."
    )
    try:
        await callback.message.edit_text(text, parse_mode="HTML", reply_markup=build_admin_keyboard())
    except Exception:
        pass

@dp.callback_query(F.data == "admin_servers")
async def callback_admin_servers(callback: types.CallbackQuery):
    if not callback.from_user or not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q!", show_alert=True)
        return

    await callback.answer("Serverlar tekshirilmoqda... ⏳")
    loading_msg = await callback.message.edit_text("⏳ <i>Serverlar va API holati tekshirilmoqda...</i>", parse_mode="HTML")

    backend_ok, b_code, b_latency = await check_url_health(f"{RENDER_BACKEND_URL}/ping")
    b_status = f"🟢 Online ({b_latency} ms)" if backend_ok else f"🔴 Kutishda / Offline (kod: {b_code})"

    front_ok, f_code, f_latency = await check_url_health(WEBAPP_URL)
    f_status = f"🟢 Online ({f_latency} ms)" if front_ok else f"🔴 Xatolik (kod: {f_code})"

    text = (
        "🌐 <b>TIZIM VA SERVERLAR HOLATI (HEALTH CHECK)</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "🖥 <b>Render FastAPI Backend:</b>\n"
        f"• Status: {b_status}\n"
        f"• URL: <code>{RENDER_BACKEND_URL}</code>\n\n"
        "📱 <b>Vercel Frontend (Web App):</b>\n"
        f"• Status: {f_status}\n"
        f"• URL: <code>{WEBAPP_URL}</code>\n\n"
        "🤖 <b>Telegram Polling Bot:</b>\n"
        f"• Status: 🟢 Cloud 24/7 rejimida faol\n"
        f"• Uptime: {format_uptime()}\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "<i>💡 Render cron-job.org orqali 24/7 doimo uyg'oq saqlanmoqda.</i>"
    )
    await loading_msg.edit_text(text, parse_mode="HTML", reply_markup=build_admin_keyboard())

@dp.callback_query(F.data == "admin_users")
async def callback_admin_users(callback: types.CallbackQuery):
    if not callback.from_user or not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q!", show_alert=True)
        return

    await callback.answer()
    users = get_latest_users(10)
    if not users:
        await callback.message.edit_text("Hozircha foydalanuvchilar mavjud emas.", reply_markup=build_admin_keyboard())
        return

    text = "👥 <b>OXIRGI 10 TA FOYDALANUVCHI:</b>\n━━━━━━━━━━━━━━━━━━━━━━\n\n"
    for i, (u_id, u_name, f_name, date_str) in enumerate(users, 1):
        mention = f"@{u_name}" if u_name else f"<code>{u_id}</code>"
        safe_name = (f_name or "Noma'lum")[:15]
        clean_date = date_str[:16].replace("T", " ") if date_str else ""
        text += f"<b>{i}.</b> {safe_name} — {mention} | <i>{clean_date}</i>\n"

    text += "\n━━━━━━━━━━━━━━━━━━━━━━"
    await callback.message.edit_text(text, parse_mode="HTML", reply_markup=build_admin_keyboard())

@dp.callback_query(F.data == "admin_export")
async def callback_admin_export(callback: types.CallbackQuery):
    if not callback.from_user or not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q!", show_alert=True)
        return

    await callback.answer("Fayl tayyorlanmoqda... 📥")
    users = get_latest_users(1000)
    
    output = io.StringIO()
    output.write("user_id,username,first_name,created_at\n")
    for u in users:
        output.write(f'"{u[0]}","{u[1]}","{u[2]}","{u[3]}"\n')
    
    csv_bytes = output.getvalue().encode("utf-8")
    doc = BufferedInputFile(csv_bytes, filename=f"users_{datetime.now().strftime('%Y%m%d')}.csv")

    await callback.message.answer_document(
        document=doc,
        caption="📁 <b>Barcha foydalanuvchilar ro'yxati (CSV eksport)</b>",
        parse_mode="HTML"
    )

@dp.callback_query(F.data == "admin_broadcast")
async def callback_admin_broadcast(callback: types.CallbackQuery, state: FSMContext):
    if not callback.from_user or not is_admin(callback.from_user.id):
        await callback.answer("Ruxsat yo'q!", show_alert=True)
        return

    await callback.answer()
    cancel_kb = InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="❌ Bekor qilish", callback_data="cancel_broadcast")]]
    )
    await state.set_state(BroadcastState.waiting_for_message)
    await callback.message.answer(
        "📢 <b>XABARNOMA YUBORISH REJIMI</b>\n\n"
        "Barcha foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yuboring (matn, rasm yoki forward):\n\n"
        "<i>Bekor qilish uchun pastdagi tugmani bosing:</i>",
        parse_mode="HTML",
        reply_markup=cancel_kb
    )

@dp.callback_query(F.data == "cancel_broadcast")
async def callback_cancel_broadcast(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.answer("Xabarnoma bekor qilindi.")
    await callback.message.edit_text("❌ <b>Xabarnoma yuborish bekor qilindi.</b>", parse_mode="HTML", reply_markup=build_admin_keyboard())

@dp.message(BroadcastState.waiting_for_message)
async def process_broadcast_message(message: types.Message, state: FSMContext, bot: Bot):
    if not message.from_user or not is_admin(message.from_user.id):
        return

    await state.clear()
    user_ids = get_all_user_ids()
    total = len(user_ids)

    if total == 0:
        await message.answer("⚠️ Baza hali bo'sh, foydalanuvchilar yo'q.", reply_markup=build_admin_keyboard())
        return

    status_msg = await message.answer(f"⏳ Xabar {total} ta foydalanuvchiga yuborilmoqda...")

    sent_count = 0
    fail_count = 0

    for uid in user_ids:
        try:
            await bot.copy_message(
                chat_id=uid,
                from_chat_id=message.chat.id,
                message_id=message.message_id
            )
            sent_count += 1
            await asyncio.sleep(0.04)
        except Exception:
            fail_count += 1

    log_broadcast(message.text or message.caption or "Media", sent_count, fail_count)

    result_text = (
        "📢 <b>XABARNOMA YAKUNLANDI!</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"✅ <b>Muvaffaqiyatli yetkazildi:</b> {sent_count} ta\n"
        f"❌ <b>Yetkazilmadi (bloklaganlar):</b> {fail_count} ta\n"
        f"👥 <b>Jami a'zolar:</b> {total} ta\n"
        "━━━━━━━━━━━━━━━━━━━━━━"
    )
    await status_msg.edit_text(result_text, parse_mode="HTML", reply_markup=build_admin_keyboard())

@dp.message(Command("app"))
async def handle_app_command(message: types.Message):
    await message.answer(
        "🚀 <b>Ilovani ochish uchun quyidagi tugmani bosing:</b>",
        parse_mode="HTML",
        reply_markup=build_inline_keyboard(WEBAPP_URL),
    )

@dp.message(Command("help"))
async def handle_help(message: types.Message):
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
    await callback.answer()
    info_text = (
        "🤖 <b>AI Speaking Analyzer Web App</b>\n\n"
        "Ushbu ilova sun'iy intellekt (Whisper STT + Gemini LLM) asosida ishlaydi.\n"
        "Talabalarga IELTS Speaking imtihoniga tayyorlanishda tezkor va aniq feedback beradi."
    )
    await callback.message.answer(
        info_text,
        parse_mode="HTML",
        reply_markup=build_inline_keyboard(WEBAPP_URL)
    )

@dp.message()
async def handle_all_messages(message: types.Message):
    if message.from_user:
        upsert_user(
            user_id=message.from_user.id,
            username=message.from_user.username or "",
            first_name=message.from_user.first_name or "",
            last_name=message.from_user.last_name or ""
        )

async def _run_bot_async():
    init_db()
    bot = Bot(token=BOT_TOKEN)
    logger.info("Cloud Telegram bot ishga tushmoqda...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

def run_bot():
    """Yangi asyncio event loop orqali botni fonda yurgizish"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_run_bot_async())

if __name__ == "__main__":
    run_bot()
