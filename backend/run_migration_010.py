"""
Run migration 010 — M03 pgvector setup.

Usage:
    python run_migration_010.py

Requires:
    - PostgreSQL with pgvector extension installed on the server
    - DATABASE_URL env var set (or .env file)
"""

import os
import sys
from pathlib import Path

# Load .env
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/orbisporte"
).replace("postgresql+psycopg2://", "postgresql://", 1)

SQL_FILE = Path(__file__).parent / "migrations" / "010_m03_pgvector.sql"


def run():
    import psycopg2
    print(f"Connecting to: {DATABASE_URL.split('@')[-1]}")   # hide credentials
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    sql = SQL_FILE.read_text(encoding="utf-8")

    # Split on semicolons that end statements (skip comment-only lines)
    statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]

    print(f"Running {len(statements)} SQL statements from {SQL_FILE.name} ...")
    ok = 0
    for i, stmt in enumerate(statements, 1):
        try:
            cur.execute(stmt)
            print(f"  [{i}/{len(statements)}] OK")
            ok += 1
        except Exception as exc:
            print(f"  [{i}/{len(statements)}] ERROR: {exc}")

    cur.close()
    conn.close()
    print(f"\nDone — {ok}/{len(statements)} statements succeeded.")
    if ok < len(statements):
        print("NOTE: Some statements failed. Ensure pgvector is installed:")
        print("  sudo apt install postgresql-16-pgvector   # or your pg version")
        print("  Then retry: python run_migration_010.py")


if __name__ == "__main__":
    run()
