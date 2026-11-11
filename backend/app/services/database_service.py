"""
ASAAS Enterprise v3.0 - Sovereign Database Management Service
Real Windows SQL Server / PostgreSQL / MySQL Engine Discovery & SQLite Studio
"""

import os
import sqlite3
import shutil
import hashlib
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import subprocess

from ..infrastructure.db import get_db_connection, DB_PATH
from ..infrastructure.win32_wts import Win32WtsService

BACKUPS_DIR = Path("data/backups")
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


class DatabaseService:
    """Manages server database engines, internal SQLite warehouse, and SQL studio queries."""

    @classmethod
    def get_database_engines(cls) -> List[Dict[str, Any]]:
        """Scans Windows services and processes to discover active database engines."""
        engines: List[Dict[str, Any]] = []

        # 1. Native Sovereign Embedded SQLite
        sqlite_size = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        engines.append({
            'name': 'ASAAS SQLite Sovereign Warehouse',
            'type': 'SQLite',
            'version': sqlite3.sqlite_version,
            'status': 'Online',
            'service_name': 'In-Process (Embedded)',
            'storage_size_bytes': sqlite_size,
            'storage_size_mb': round(sqlite_size / (1024 * 1024), 2),
            'database_path': str(DB_PATH.resolve()),
            'is_default': True
        })

        # 2. Windows Service Probe for Microsoft SQL Server, PostgreSQL, MySQL
        try:
            ps_cmd = (
                "Get-Service | Where-Object { $_.Name -match 'MSSQL|SQLServer|postgres|mysql|mariadb' } "
                "| Select-Object Name, DisplayName, Status, StartType | ConvertTo-Json -Compress"
            )
            out = subprocess.check_output(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
                timeout=8,
                stderr=subprocess.DEVNULL
            ).decode('utf-8', errors='ignore').strip()

            if out:
                import json
                parsed = json.loads(out)
                items = parsed if isinstance(parsed, list) else [parsed]
                for it in items:
                    raw_name = it.get('Name', '')
                    raw_display = it.get('DisplayName', '')
                    st = it.get('Status', 'Unknown')
                    st_str = 'Online' if st in (4, 'Running', 'running') else 'Stopped'

                    db_type = 'SQL Server' if 'sql' in raw_name.lower() else (
                        'PostgreSQL' if 'postgres' in raw_name.lower() else 'MySQL'
                    )

                    engines.append({
                        'name': raw_display or raw_name,
                        'type': db_type,
                        'version': 'Windows Service',
                        'status': st_str,
                        'service_name': raw_name,
                        'storage_size_bytes': 0,
                        'storage_size_mb': 0,
                        'database_path': f"Windows Service: {raw_name}",
                        'is_default': False
                    })
        except Exception:
            pass

        return engines

    @classmethod
    def get_system_database_stats(cls) -> Dict[str, Any]:
        """Returns deep telemetry and health metrics for the sovereign ASAAS database."""
        if not DB_PATH.exists():
            return {'ok': False, 'error': 'قاعدة البيانات غير موجودة'}

        file_size = DB_PATH.stat().st_size
        modified_at = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(DB_PATH.stat().st_mtime))

        with get_db_connection() as con:
            cur = con.cursor()
            # PRAGMA checks
            integrity = cur.execute("PRAGMA integrity_check").fetchone()[0]
            journal_mode = cur.execute("PRAGMA journal_mode").fetchone()[0]
            page_size = cur.execute("PRAGMA page_size").fetchone()[0]
            page_count = cur.execute("PRAGMA page_count").fetchone()[0]
            freelist_count = cur.execute("PRAGMA freelist_count").fetchone()[0]

            # Count all tables and total records
            tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall()
            total_records = 0
            for (tname,) in tables:
                try:
                    c = cur.execute(f"SELECT count(1) FROM [{tname}]").fetchone()[0]
                    total_records += c
                except Exception:
                    pass

        return {
            'ok': True,
            'file_path': str(DB_PATH.resolve()),
            'file_size_bytes': file_size,
            'file_size_mb': round(file_size / (1024 * 1024), 2),
            'last_modified': modified_at,
            'integrity_status': integrity,
            'journal_mode': journal_mode,
            'page_size': page_size,
            'page_count': page_count,
            'free_pages': freelist_count,
            'total_tables': len(tables),
            'total_records': total_records,
            'wal_enabled': journal_mode.upper() == 'WAL'
        }

    @classmethod
    def get_tables_list(cls) -> List[Dict[str, Any]]:
        """Returns detailed inventory of all tables, schema definitions, and row counts."""
        tables_meta: List[Dict[str, Any]] = []

        with get_db_connection() as con:
            cur = con.cursor()
            tables = cur.execute(
                "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
            ).fetchall()

            for tname, create_sql in tables:
                try:
                    row_count = cur.execute(f"SELECT count(1) FROM [{tname}]").fetchone()[0]
                except Exception:
                    row_count = 0

                columns = []
                try:
                    cols = cur.execute(f"PRAGMA table_info([{tname}])").fetchall()
                    for col in cols:
                        columns.append({
                            'cid': col[0],
                            'name': col[1],
                            'type': col[2],
                            'notnull': bool(col[3]),
                            'default_value': col[4],
                            'pk': bool(col[5])
                        })
                except Exception:
                    pass

                tables_meta.append({
                    'name': tname,
                    'row_count': row_count,
                    'column_count': len(columns),
                    'columns': columns,
                    'create_sql': create_sql
                })

        return tables_meta

    @classmethod
    def get_table_data(cls, table_name: str, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Fetches rows and column metadata for a given table with pagination."""
        with get_db_connection() as con:
            cur = con.cursor()

            # Verify table exists in sqlite_master to prevent SQL injection
            exists = cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                (table_name,)
            ).fetchone()

            if not exists:
                return {'ok': False, 'error': f'الجدول [{table_name}] غير موجود في قاعدة البيانات.'}

            # Columns
            col_info = cur.execute(f"PRAGMA table_info([{table_name}])").fetchall()
            columns = [c[1] for c in col_info]

            # Total Rows
            total = cur.execute(f"SELECT count(1) FROM [{table_name}]").fetchone()[0]

            # Fetch paged rows
            cur.execute(f"SELECT * FROM [{table_name}] LIMIT ? OFFSET ?", (limit, offset))
            raw_rows = cur.fetchall()

            rows = []
            for r in raw_rows:
                row_dict = {}
                for idx, col in enumerate(columns):
                    val = r[idx]
                    # Redact potential sensitive raw keys in vault unless revealed explicitly
                    if table_name == 'vault_credentials' and col in ('secret_enc', 'secret_tag', 'secret_nonce'):
                        val = '[ENCRYPTED AES-256-GCM]'
                    elif table_name == 'app_users' and col == 'password_hash':
                        val = '[BCRYPT / SHA-256 HASH]'
                    row_dict[col] = val
                rows.append(row_dict)

        return {
            'ok': True,
            'table': table_name,
            'columns': columns,
            'rows': rows,
            'total': total,
            'limit': limit,
            'offset': offset
        }

    @classmethod
    def execute_custom_query(cls, sql_query: str, actor: str = 'admin') -> Dict[str, Any]:
        """Executes a SQL query safely and returns structured columns, rows, and execution time."""
        clean_sql = sql_query.strip()
        if not clean_sql:
            return {'ok': False, 'error': 'الاستعلام فارغ.'}

        # Prevent dropping essential system tables via ad-hoc query
        upper_sql = clean_sql.upper()
        if 'DROP TABLE' in upper_sql or 'DROP DATABASE' in upper_sql:
            return {'ok': False, 'error': 'أمر DROP محظور أمنياً لحماية تكامل بيانات المنظومة السيادية.'}

        t0 = time.perf_counter()
        with get_db_connection() as con:
            cur = con.cursor()
            try:
                cur.execute(clean_sql)
                duration_ms = round((time.perf_counter() - t0) * 1000, 2)

                if cur.description:
                    columns = [d[0] for d in cur.description]
                    raw_rows = cur.fetchmany(100)
                    rows = [[str(v) if v is not None else 'NULL' for v in row] for row in raw_rows]
                    return {
                        'ok': True,
                        'is_select': True,
                        'columns': columns,
                        'rows': rows,
                        'row_count': len(rows),
                        'duration_ms': duration_ms,
                        'truncated': len(raw_rows) == 100
                    }
                else:
                    con.commit()
                    affected = cur.rowcount
                    return {
                        'ok': True,
                        'is_select': False,
                        'affected_rows': affected,
                        'duration_ms': duration_ms,
                        'message': f'تم تنفيذ الاستعلام بنجاح. عدد الصفوف المتأثرة: {affected}'
                    }
            except Exception as exc:
                return {'ok': False, 'error': f'خطأ أثناء تنفيذ SQL: {str(exc)}'}

    @classmethod
    def create_backup(cls, description: str = 'Manual Snapshot') -> Dict[str, Any]:
        """Creates an authenticated, timestamped physical backup of the sovereign database."""
        timestamp = time.strftime('%Y%m%d_%H%M%S')
        backup_filename = f"asaas_v2_backup_{timestamp}.db"
        dest_path = BACKUPS_DIR / backup_filename

        try:
            # Safely backup using SQLite backup API
            with get_db_connection() as src_con:
                dest_con = sqlite3.connect(str(dest_path))
                with dest_con:
                    src_con.backup(dest_con, pages=50)
                dest_con.close()

            # Compute SHA-256
            hasher = hashlib.sha256()
            with open(dest_path, 'rb') as f:
                while chunk := f.read(65536):
                    hasher.update(chunk)
            sha256_hash = hasher.hexdigest()
            size_bytes = dest_path.stat().st_size

            return {
                'ok': True,
                'filename': backup_filename,
                'path': str(dest_path.resolve()),
                'size_bytes': size_bytes,
                'size_mb': round(size_bytes / (1024 * 1024), 2),
                'sha256': sha256_hash,
                'created_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                'description': description
            }
        except Exception as exc:
            return {'ok': False, 'error': f'فشل إنشاء النسخة الاحتياطية: {str(exc)}'}

    @classmethod
    def list_backups(cls) -> List[Dict[str, Any]]:
        """Lists existing physical database snapshots stored in the sovereign vault."""
        backups: List[Dict[str, Any]] = []
        if not BACKUPS_DIR.exists():
            return backups

        for item in sorted(BACKUPS_DIR.glob("*.db"), key=lambda p: p.stat().st_mtime, reverse=True):
            size = item.stat().st_size
            mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(item.stat().st_mtime))
            backups.append({
                'filename': item.name,
                'path': str(item.resolve()),
                'size_bytes': size,
                'size_mb': round(size / (1024 * 1024), 2),
                'modified_at': mtime
            })
        return backups

    @classmethod
    def optimize_database(cls) -> Dict[str, Any]:
        """Runs VACUUM, ANALYZE, and PRAGMA optimize to clean free space and rebuild indices."""
        size_before = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        t0 = time.perf_counter()

        with get_db_connection() as con:
            con.execute("PRAGMA optimize")
            con.execute("ANALYZE")
            con.execute("VACUUM")

        size_after = DB_PATH.stat().st_size if DB_PATH.exists() else 0
        reclaimed = max(0, size_before - size_after)
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)

        return {
            'ok': True,
            'size_before_bytes': size_before,
            'size_after_bytes': size_after,
            'reclaimed_bytes': reclaimed,
            'reclaimed_kb': round(reclaimed / 1024, 2),
            'duration_ms': duration_ms,
            'message': f'تم تحسين وفهرسة قاعدة البيانات بنجاح في {duration_ms}ms.'
        }
