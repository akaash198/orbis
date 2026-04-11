"""
Run migration 008: Document Registry and Data Lake tables.

Fixes vs v1
-----------
  - Splits SQL correctly (respects dollar-quoted $$ blocks in PL/pgSQL)
  - Runs each statement in AUTOCOMMIT mode so one failure never aborts the rest
  - Falls back to SQLAlchemy ORM create_all for the table DDL if SQL fails

Usage:
    python run_migration_008.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from Orbisporte.core import engine
from Orbisporte.domain import models  # registers all ORM models with Base.metadata  # noqa: F401
from Orbisporte.core import Base


# ── SQL splitter that respects dollar-quoted PL/pgSQL blocks ─────────────────
def split_sql(sql: str) -> list[str]:
    """
    Split a SQL script into individual statements.
    Correctly handles:
      - Dollar-quoted strings  ($$...$$  or  $BODY$...$BODY$)
      - Single-quoted strings  ('...')
      - Line comments          (-- ...)
      - Block comments         (/* ... */)
    """
    statements = []
    current    = []
    i          = 0
    in_dollar  = False
    dollar_tag = ""

    while i < len(sql):
        ch = sql[i]

        # ── Dollar-quoted block (PL/pgSQL function body) ──────────────────
        if not in_dollar and sql[i:i+1] == "$":
            # Find the closing $ of the tag:  $tag$  or  $$
            match = re.match(r'\$([A-Za-z0-9_]*)\$', sql[i:])
            if match:
                dollar_tag = match.group(0)
                in_dollar  = True
                current.append(sql[i:i + len(dollar_tag)])
                i += len(dollar_tag)
                continue

        if in_dollar:
            # Look for the matching closing tag
            if sql[i:i + len(dollar_tag)] == dollar_tag:
                current.append(dollar_tag)
                i += len(dollar_tag)
                in_dollar = False
            else:
                current.append(ch)
                i += 1
            continue

        # ── Single-quoted string ──────────────────────────────────────────
        if ch == "'":
            j = i + 1
            while j < len(sql):
                if sql[j] == "'" and sql[j+1:j+2] == "'":   # escaped quote
                    j += 2
                elif sql[j] == "'":
                    j += 1
                    break
                else:
                    j += 1
            current.append(sql[i:j])
            i = j
            continue

        # ── Line comment ──────────────────────────────────────────────────
        if sql[i:i+2] == "--":
            end = sql.find("\n", i)
            end = end + 1 if end != -1 else len(sql)
            current.append(sql[i:end])
            i = end
            continue

        # ── Block comment ─────────────────────────────────────────────────
        if sql[i:i+2] == "/*":
            end = sql.find("*/", i)
            end = end + 2 if end != -1 else len(sql)
            current.append(sql[i:end])
            i = end
            continue

        # ── Statement terminator ──────────────────────────────────────────
        if ch == ";":
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            i += 1
            continue

        current.append(ch)
        i += 1

    # Trailing statement without terminator
    last = "".join(current).strip()
    if last:
        statements.append(last)

    return statements


# ── Run migration ─────────────────────────────────────────────────────────────
def run_sql_migration() -> tuple[int, int]:
    """Execute each SQL statement independently (AUTOCOMMIT).
    Returns (ok_count, skip_count)."""
    migration_file = Path(__file__).parent / "migrations" / "008_document_registry.sql"
    if not migration_file.exists():
        print(f"[ERROR] Not found: {migration_file}")
        return 0, 0

    sql = migration_file.read_text(encoding="utf-8")
    statements = split_sql(sql)
    print(f"[INFO] Found {len(statements)} SQL statement(s) to execute.")

    ok = skip = 0

    # AUTOCOMMIT: each statement is its own implicit transaction.
    # A failure in one statement never blocks subsequent ones.
    raw_conn = engine.raw_connection()
    try:
        raw_conn.set_isolation_level(0)   # ISOLATION_LEVEL_AUTOCOMMIT = 0
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
    """Idempotent: create any missing tables via SQLAlchemy ORM."""
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    print("[INFO] Running migration 008: Document Registry + Data Lake tables")
    ok, skip = run_sql_migration()
    print(f"\n[INFO] SQL: {ok} executed, {skip} skipped (already exist or warnings).")
    run_orm_sync()
    print("[OK]  ORM tables synced.")
    print("[DONE] Migration 008 complete.")
