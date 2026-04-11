"""
Run M05 migration — creates m05_boe_filings, m05_boe_line_items, m05_icegate_log tables.

Usage:
    python run_migration_013.py
"""

import os
import sys
from pathlib import Path

env_path = Path(__file__).parent / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        pass

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin@localhost:5432/orbisporte_db"
).replace("postgresql+psycopg2://", "postgresql://", 1)

MIGRATION_FILE = Path(__file__).parent / "migrations" / "013_m05_boe_filing.sql"


def _strip_comments(segment: str) -> str:
    """Remove leading -- comment lines from a SQL segment."""
    lines = segment.splitlines()
    result = []
    for line in lines:
        if line.strip().startswith("--") and not result:
            continue  # skip leading comment lines
        result.append(line)
    return "\n".join(result).strip()


def run_file(cur, sql_file: Path):
    sql = sql_file.read_text(encoding="utf-8")
    raw_segments = sql.split(";")
    statements = []
    for seg in raw_segments:
        cleaned = _strip_comments(seg)
        if cleaned:
            statements.append(cleaned)
    ok = failed = 0
    for i, stmt in enumerate(statements, 1):
        try:
            cur.execute(stmt)
            print(f"  [{i}/{len(statements)}] OK")
            ok += 1
        except Exception as exc:
            msg = str(exc).strip()
            if "already exists" in msg or "duplicate" in msg.lower():
                print(f"  [{i}/{len(statements)}] SKIP (already exists)")
                ok += 1
            else:
                print(f"  [{i}/{len(statements)}] ERROR: {msg}")
                failed += 1
    return ok, failed


def main():
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed.")
        sys.exit(1)

    display_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    print(f"Connecting to: {display_url}")

    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as exc:
        print(f"ERROR: Cannot connect: {exc}")
        sys.exit(1)

    conn.autocommit = True
    cur = conn.cursor()

    print(f"\n── Running {MIGRATION_FILE.name} ──────────────────────────────")
    ok, failed = run_file(cur, MIGRATION_FILE)

    cur.close()
    conn.close()

    print(f"\nMigration complete — {ok} OK / {failed} failed")
    if failed:
        sys.exit(1)
    else:
        print("M05 tables ready. Restart the backend.")


if __name__ == "__main__":
    main()
