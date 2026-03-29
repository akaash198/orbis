"""
Load HSN CSV into PostgreSQL — no pgvector required.

Creates an `hsn_codes` table with the full ITC(HS) 2012 dataset and
useful indexes for fast querying by code, chapter, keyword, and policy.

Usage
-----
    python load_hsn_to_postgres.py

Environment
-----------
    DATABASE_URL  — read from backend/.env automatically
    CSV path      — D:\\SPECTRA\\ITCHS_2012.csv (hardcoded, matches import_hsn_csv.py)
"""

import csv
import logging
import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("hsn_load")

CSV_PATH     = Path(r"D:\SPECTRA\ITCHS_2012.csv")
BATCH_SIZE   = 500
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:PRATHAM@localhost:5432/orbisporte_db")


# ── Create table ──────────────────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS hsn_codes (
    id           SERIAL PRIMARY KEY,
    hsn_code     VARCHAR(8)   NOT NULL UNIQUE,
    description  TEXT,
    hs4          TEXT,
    hs5          TEXT,
    hs6          TEXT,
    hs8          TEXT,
    chapter      SMALLINT     GENERATED ALWAYS AS (
                     CASE WHEN hsn_code ~ '^[0-9]{2}'
                          THEN CAST(LEFT(hsn_code, 2) AS SMALLINT)
                          ELSE NULL END
                 ) STORED,
    chapter_name TEXT,
    policy       VARCHAR(50),
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hsn_codes_chapter  ON hsn_codes(chapter);
CREATE INDEX IF NOT EXISTS idx_hsn_codes_policy   ON hsn_codes(policy);
CREATE INDEX IF NOT EXISTS idx_hsn_codes_prefix4  ON hsn_codes(LEFT(hsn_code, 4));
CREATE INDEX IF NOT EXISTS idx_hsn_codes_desc_fts
    ON hsn_codes USING gin(to_tsvector('english', COALESCE(description, '')));
"""


def get_conn():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        log.info("Connected to PostgreSQL: %s", DATABASE_URL.split("@")[-1])
        return conn
    except Exception as exc:
        log.error("Cannot connect to PostgreSQL: %s", exc)
        sys.exit(1)


def create_table(conn):
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
    conn.commit()
    log.info("Table hsn_codes ready.")


def load_csv(conn):
    if not CSV_PATH.exists():
        log.error("CSV not found: %s", CSV_PATH)
        sys.exit(1)

    log.info("Reading CSV: %s", CSV_PATH)

    rows = []
    skipped = 0

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for raw in reader:
            hsn_raw = (raw.get("ITC(HS)") or "").strip().replace(" ", "")
            if not hsn_raw:
                skipped += 1
                continue

            hsn_code = hsn_raw.zfill(8)[:8]
            hs4      = (raw.get("HS(4)") or "").strip() or None

            rows.append((
                hsn_code,
                (raw.get("Description") or "").strip() or None,
                hs4,
                (raw.get("HS(5)") or "").strip() or None,
                (raw.get("HS(6)") or "").strip() or None,
                (raw.get("HS(8)") or "").strip() or None,
                hs4,   # chapter_name = HS(4) heading
                (raw.get("Policy")      or "").strip() or None,
            ))

    log.info("Parsed %d rows (skipped %d empty)", len(rows), skipped)

    # Deduplicate — keep last occurrence of each hsn_code (CSV has duplicates)
    seen = {}
    for row in rows:
        seen[row[0]] = row   # key = hsn_code
    rows = list(seen.values())
    log.info("After dedup: %d unique HSN codes", len(rows))

    upsert_sql = """
        INSERT INTO hsn_codes
            (hsn_code, description, hs4, hs5, hs6, hs8, chapter_name, policy)
        VALUES %s
        ON CONFLICT (hsn_code) DO UPDATE SET
            description  = EXCLUDED.description,
            hs4          = EXCLUDED.hs4,
            hs5          = EXCLUDED.hs5,
            hs6          = EXCLUDED.hs6,
            hs8          = EXCLUDED.hs8,
            chapter_name = EXCLUDED.chapter_name,
            policy       = EXCLUDED.policy
    """

    total = 0
    t0 = time.time()
    with conn.cursor() as cur:
        for start in range(0, len(rows), BATCH_SIZE):
            batch = rows[start: start + BATCH_SIZE]
            psycopg2.extras.execute_values(cur, upsert_sql, batch, page_size=BATCH_SIZE)
            total += len(batch)
            log.info("  Upserted %d / %d rows …", total, len(rows))
    conn.commit()

    elapsed = time.time() - t0
    log.info("Load complete — %d rows in %.1fs", total, elapsed)


def print_summary(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM hsn_codes")
        total = cur.fetchone()[0]

        cur.execute("""
            SELECT chapter, chapter_name, COUNT(*) AS codes
            FROM hsn_codes
            GROUP BY chapter, chapter_name
            ORDER BY chapter
            LIMIT 20
        """)
        rows = cur.fetchall()

    print(f"\n{'='*60}")
    print(f"  hsn_codes table: {total} rows loaded")
    print(f"{'='*60}")
    print(f"  {'Ch':>3}  {'Chapter Name':<40}  {'Codes':>5}")
    print(f"  {'-'*3}  {'-'*40}  {'-'*5}")
    for chapter, name, count in rows:
        print(f"  {chapter:>3}  {(name or ''):<40}  {count:>5}")
    print(f"{'='*60}\n")
    print("Sample queries you can now run:")
    print()
    print("  -- All codes in Chapter 85 (Electrical)")
    print("  SELECT hsn_code, description FROM hsn_codes WHERE chapter = 85;")
    print()
    print("  -- Keyword search")
    print("  SELECT hsn_code, description FROM hsn_codes")
    print("  WHERE description ILIKE '%laptop%';")
    print()
    print("  -- Full-text search")
    print("  SELECT hsn_code, description FROM hsn_codes")
    print("  WHERE to_tsvector('english', description) @@ plainto_tsquery('solar panel');")
    print()
    print("  -- Restricted goods")
    print("  SELECT hsn_code, description, policy FROM hsn_codes")
    print("  WHERE policy ILIKE '%Restricted%' ORDER BY hsn_code;")
    print()


if __name__ == "__main__":
    conn = get_conn()
    try:
        create_table(conn)
        load_csv(conn)
        print_summary(conn)
    finally:
        conn.close()
