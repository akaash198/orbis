"""
Run M04 migrations — creates duty_rates (001) + all M04 tables (012).

Usage:
    python run_migration_012.py

Requires:
    - PostgreSQL running and reachable
    - DATABASE_URL env var set, or a .env file in this directory
"""

import os
import sys
from pathlib import Path

# ── Load .env if present ──────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        pass  # dotenv not installed; rely on env vars

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:admin@localhost:5432/orbisporte_db"
).replace("postgresql+psycopg2://", "postgresql://", 1)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

# Run these two in order — 001 creates duty_rates, 012 creates M04 tables
MIGRATION_FILES = [
    MIGRATIONS_DIR / "001_duty_rates_table.sql",
    MIGRATIONS_DIR / "012_m04_duty_engine.sql",
]


def _strip_leading_comments(segment: str) -> str:
    """Remove leading -- comment lines from a SQL segment, return remaining SQL."""
    lines = segment.splitlines()
    sql_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("--"):
            # skip comment line, but only if we haven't hit real SQL yet
            if not sql_lines:
                continue
        sql_lines.append(line)
    return "\n".join(sql_lines).strip()


def run_file(cur, sql_file: Path) -> tuple[int, int]:
    """Execute all statements in a SQL file. Returns (ok, failed) counts."""
    sql = sql_file.read_text(encoding="utf-8")
    # Split on semicolons, strip leading comment lines, keep non-empty SQL segments
    raw_segments = sql.split(";")
    statements = []
    for seg in raw_segments:
        cleaned = _strip_leading_comments(seg)
        if cleaned:
            statements.append(cleaned)
    ok = failed = 0
    for i, stmt in enumerate(statements, 1):
        try:
            cur.execute(stmt)
            print(f"    [{i}/{len(statements)}] OK")
            ok += 1
        except Exception as exc:
            # "already exists" errors are harmless — table was created by a prior run
            msg = str(exc).strip()
            if "already exists" in msg or "duplicate" in msg.lower():
                print(f"    [{i}/{len(statements)}] SKIP (already exists)")
                ok += 1
            else:
                print(f"    [{i}/{len(statements)}] ERROR: {msg}")
                failed += 1
    return ok, failed


def main():
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    # Hide password from log
    display_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    print(f"Connecting to: {display_url}")

    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as exc:
        print(f"ERROR: Cannot connect to database: {exc}")
        print()
        print("Check your DATABASE_URL in .env — default used:")
        print(f"  {DATABASE_URL}")
        sys.exit(1)

    conn.autocommit = True
    cur = conn.cursor()

    total_ok = total_fail = 0

    for sql_file in MIGRATION_FILES:
        if not sql_file.exists():
            print(f"\nWARNING: {sql_file.name} not found, skipping.")
            continue
        print(f"\n── Running {sql_file.name} ──────────────────────────────")
        ok, fail = run_file(cur, sql_file)
        total_ok += ok
        total_fail += fail
        status = "DONE" if fail == 0 else f"DONE WITH {fail} ERROR(S)"
        print(f"  → {status}  ({ok} statements succeeded)")

    cur.close()
    conn.close()

    print()
    print(f"Migration complete — {total_ok} OK / {total_fail} failed")

    if total_fail > 0:
        print()
        print("Some statements failed. Common causes:")
        print("  • Table already exists but with a different schema → drop it and retry")
        print("  • pgvector extension not installed (only needed for M03 tables)")
        sys.exit(1)
    else:
        print()
        print("All M04 tables are ready. Restart the backend and try again.")


if __name__ == "__main__":
    main()
