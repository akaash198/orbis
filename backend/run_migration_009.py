"""
Run migration 009: M02 Extraction Results table.

Usage:
    python run_migration_009.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from Orbisporte.core import engine
from Orbisporte.domain import models  # noqa: F401
from Orbisporte.core import Base


def split_sql(sql: str) -> list[str]:
    statements = []
    current = []
    i = 0
    while i < len(sql):
        ch = sql[i]
        if sql[i:i+2] == "--":
            end = sql.find("\n", i)
            end = end + 1 if end != -1 else len(sql)
            current.append(sql[i:end])
            i = end
            continue
        if ch == ";":
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue
        current.append(ch)
        i += 1
    last = "".join(current).strip()
    if last:
        statements.append(last)
    return statements


def run_sql_migration() -> tuple[int, int]:
    migration_file = Path(__file__).parent / "migrations" / "009_m02_results.sql"
    if not migration_file.exists():
        print(f"[ERROR] Not found: {migration_file}")
        return 0, 0

    sql = migration_file.read_text(encoding="utf-8")
    statements = split_sql(sql)
    print(f"[INFO] Found {len(statements)} SQL statement(s) to execute.")

    ok = skip = 0
    raw_conn = engine.raw_connection()
    try:
        raw_conn.set_isolation_level(0)
        cursor = raw_conn.cursor()
        for stmt in statements:
            preview = stmt[:80].replace("\n", " ")
            try:
                cursor.execute(stmt)
                print(f"  [OK]  {preview}…")
                ok += 1
            except Exception as exc:
                short = str(exc).split("\n")[0]
                print(f"  [SKIP] {short}")
                print(f"         → {preview}…")
                skip += 1
        cursor.close()
    finally:
        raw_conn.close()

    return ok, skip


def run_orm_sync():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    print("[INFO] Running migration 009: M02 Extraction Results table")
    ok, skip = run_sql_migration()
    print(f"\n[INFO] SQL: {ok} executed, {skip} skipped.")
    run_orm_sync()
    print("[OK]  ORM tables synced.")
    print("[DONE] Migration 009 complete.")
