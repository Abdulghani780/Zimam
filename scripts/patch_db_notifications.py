from pathlib import Path

p = Path('backend/app/infrastructure/db.py')
text = p.read_text(encoding='utf-8')

target = 'CREATE TABLE IF NOT EXISTS jit_grants ('
if target in text and 'user_notifications' not in text:
    table_code = """
            # 9. User Desktop Notifications & Broadcasts
            cur.execute(\"\"\"
                CREATE TABLE IF NOT EXISTS user_notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    target_user TEXT NOT NULL,
                    session_id INTEGER NOT NULL,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'DELIVERED',
                    is_read INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
            \"\"\")
"""
    insert_point = text.find('# Seed default users if empty')
    text = text[:insert_point] + table_code + text[insert_point:]

functions_code = """

# ==============================================================================
# User Notifications & Desktop Broadcast
# ==============================================================================

def db_add_user_notification(target_user: str, session_id: int, title: str, message: str, sender: str = 'Admin') -> Dict[str, Any]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        now_str = datetime.now(timezone.utc).isoformat()
        cur.execute(\"\"\"
            INSERT INTO user_notifications (target_user, session_id, title, message, sender, status, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 'DELIVERED', 0, ?)
        \"\"\", (target_user, session_id, title, message, sender, now_str))
        conn.commit()
        return {'ok': True, 'id': cur.lastrowid, 'target_user': target_user, 'title': title, 'created_at': now_str}


def db_list_user_notifications(limit: int = 20, unread_only: bool = False) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cur = conn.cursor()
        sql = "SELECT * FROM user_notifications"
        if unread_only:
            sql += " WHERE is_read = 0"
        sql += " ORDER BY id DESC LIMIT ?"
        cur.execute(sql, (limit,))
        return [dict(row) for row in cur.fetchall()]


def db_mark_notification_read(notif_id: int) -> bool:
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE user_notifications SET is_read = 1 WHERE id = ?", (notif_id,))
        conn.commit()
        return cur.rowcount > 0
"""

if 'db_add_user_notification' not in text:
    text += functions_code

p.write_text(text, encoding='utf-8')
print("db.py updated successfully!")
