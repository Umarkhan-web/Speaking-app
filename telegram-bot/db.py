import sqlite3
import datetime
from pathlib import Path

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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.datetime.utcnow().isoformat()
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

def get_stats():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Jami foydalanuvchilar
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    
    # Bugun qo'shilganlar
    cursor.execute("SELECT COUNT(*) FROM users WHERE date(created_at) = date('now')")
    today_users = cursor.fetchone()[0]
    
    # Oxirgi 24 soatda faol bo'lganlar
    cursor.execute("SELECT COUNT(*) FROM users WHERE datetime(last_seen) >= datetime('now', '-1 day')")
    active_24h = cursor.fetchone()[0]
    
    # Oxirgi 7 kunda qo'shilganlar
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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO broadcasts (message_text, sent_count, failed_count)
        VALUES (?, ?, ?)
    """, (text[:500], sent, failed))
    conn.commit()
    conn.close()
