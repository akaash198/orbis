"""
HSN CSV Import + Embedding Script
===================================
Imports D:\\SPECTRA\\ITCHS_2012.csv into the hsn_embeddings PostgreSQL table,
then generates OpenAI text-embedding-3-small (1536-dim) embeddings for every row.

CSV columns:
    ITC(HS)     — 8-digit HSN code (may have leading zeros)
    Description — item-level description  (HS(8) equivalent)
    HS(4)       — chapter/heading name
    HS(5)       — sub-heading name
    HS(6)       — sub-heading name
    HS(8)       — 8-digit line description (same as Description in most rows)
    Policy      — Free / Restricted / Other

Usage
-----
  # Phase 1 only (fast CSV load, no embeddings)
  python import_hsn_csv.py --phase 1

  # Phase 2 only (generate embeddings for rows without one)
  python import_hsn_csv.py --phase 2

  # Full run: Phase 1 then Phase 2
  python import_hsn_csv.py

Environment variables required:
  DATABASE_URL   — e.g. postgresql://user:pass@localhost:5432/orbisporte
  OPENAI_API_KEY — OpenAI secret key (Phase 2 only)
"""

import argparse
import logging
import os
import sys
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load .env from the backend directory (where this script lives)
load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("hsn_import")

# ── Constants ─────────────────────────────────────────────────────────────────

CSV_PATH = Path(r"D:\SPECTRA\ITCHS_2012.csv")
EMBED_MODEL     = "text-embedding-3-small"
EMBEDDING_BATCH = 128         # rows per OpenAI embeddings call (OpenAI supports up to 2048)
DB_UPSERT_BATCH = 500         # rows per DB INSERT batch
EMBED_PAUSE_SEC = 0.2         # brief pause between OpenAI batches to respect rate limits


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        log.error("DATABASE_URL environment variable is not set.")
        sys.exit(1)
    return psycopg2.connect(db_url)


# ── Description builder ───────────────────────────────────────────────────────

def build_rich_description(row: dict) -> str:
    """
    Combine multiple CSV columns into a single rich description string
    that gives Voyage-4-large the most semantic signal.

    Format:
      Chapter: <HS(4)>. Sub-heading: <HS(5)>. Item: <Description>
    """
    parts = []

    ch = (row.get("HS(4)") or "").strip()
    if ch:
        parts.append(f"Chapter: {ch}")

    sub5 = (row.get("HS(5)") or "").strip()
    if sub5 and sub5 != ch:
        parts.append(f"Sub-heading: {sub5}")

    sub6 = (row.get("HS(6)") or "").strip()
    if sub6 and sub6 not in (ch, sub5):
        parts.append(f"Detail: {sub6}")

    desc = (row.get("Description") or "").strip()
    if desc:
        parts.append(f"Item: {desc}")

    return ". ".join(parts) if parts else desc


# ── Phase 1: CSV → PostgreSQL ─────────────────────────────────────────────────

def phase1_load_csv():
    """Read the CSV and bulk-upsert all rows into hsn_embeddings (no embeddings yet)."""
    import csv

    if not CSV_PATH.exists():
        log.error("CSV not found: %s", CSV_PATH)
        sys.exit(1)

    log.info("Phase 1 — reading %s …", CSV_PATH)

    rows_to_insert = []
    skipped = 0

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        for lineno, raw in enumerate(reader, start=2):  # line 1 is header
            hsn_raw = (raw.get("ITC(HS)") or "").strip().replace(" ", "")
            if not hsn_raw:
                skipped += 1
                continue

            # Normalise to 8-digit zero-padded string
            hsn_code = hsn_raw.zfill(8)[:8]

            # Chapter = first 2 digits
            try:
                chapter = int(hsn_code[:2])
            except ValueError:
                skipped += 1
                continue

            chapter_name = (raw.get("HS(4)") or "").strip() or None
            description  = build_rich_description(raw)
            policy       = (raw.get("Policy") or "").strip() or None

            rows_to_insert.append({
                "hsn_code":     hsn_code,
                "description":  description,
                "chapter":      chapter,
                "chapter_name": chapter_name,
                "notes":        policy,
            })

    log.info("Parsed %d valid rows, skipped %d", len(rows_to_insert), skipped)

    if not rows_to_insert:
        log.warning("No rows to insert.")
        return

    upsert_sql = """
        INSERT INTO hsn_embeddings
            (hsn_code, description, chapter, chapter_name, notes)
        VALUES
            %(hsn_code)s, %(description)s, %(chapter)s, %(chapter_name)s, %(notes)s)
        ON CONFLICT (hsn_code) DO UPDATE SET
            description  = EXCLUDED.description,
            chapter      = EXCLUDED.chapter,
            chapter_name = EXCLUDED.chapter_name,
            notes        = EXCLUDED.notes
    """

    # Correct parameterised form for psycopg2 executemany
    upsert_sql = """
        INSERT INTO hsn_embeddings
            (hsn_code, description, chapter, chapter_name, notes)
        VALUES
            (%s, %s, %s, %s, %s)
        ON CONFLICT (hsn_code) DO UPDATE SET
            description  = EXCLUDED.description,
            chapter      = EXCLUDED.chapter,
            chapter_name = EXCLUDED.chapter_name,
            notes        = EXCLUDED.notes
    """

    conn = get_conn()
    total_inserted = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for start in range(0, len(rows_to_insert), DB_UPSERT_BATCH):
                    batch = rows_to_insert[start: start + DB_UPSERT_BATCH]
                    tuples = [
                        (r["hsn_code"], r["description"], r["chapter"],
                         r["chapter_name"], r["notes"])
                        for r in batch
                    ]
                    psycopg2.extras.execute_batch(cur, upsert_sql, tuples, page_size=DB_UPSERT_BATCH)
                    total_inserted += len(batch)
                    log.info("  Upserted %d / %d rows …", total_inserted, len(rows_to_insert))
        log.info("Phase 1 complete — %d rows upserted.", total_inserted)
    finally:
        conn.close()


# ── Phase 2: Generate OpenAI text-embedding-3-small embeddings ───────────────

def phase2_embed():
    """Fetch rows without embeddings and generate OpenAI 1536-dim vectors in batches."""
    from openai import OpenAI

    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        log.error("OPENAI_API_KEY environment variable is not set.")
        sys.exit(1)

    client = OpenAI(api_key=openai_key)

    conn = get_conn()
    try:
        # Fetch all un-embedded rows
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT id, description FROM hsn_embeddings WHERE embedding IS NULL ORDER BY id"
            )
            rows = cur.fetchall()

        if not rows:
            log.info("Phase 2 — all rows already embedded. Nothing to do.")
            return

        log.info("Phase 2 — embedding %d un-embedded rows with %s …", len(rows), EMBED_MODEL)

        update_sql = """
            UPDATE hsn_embeddings
            SET embedding = %s::vector, embedded_at = NOW()
            WHERE id = %s
        """

        total_done = 0
        for batch_start in range(0, len(rows), EMBEDDING_BATCH):
            batch = rows[batch_start: batch_start + EMBEDDING_BATCH]
            texts = [r["description"] for r in batch]
            ids   = [r["id"]          for r in batch]

            try:
                response = client.embeddings.create(input=texts, model=EMBED_MODEL)
                embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
            except Exception as exc:
                log.error("OpenAI API error at batch starting id=%s: %s", ids[0], exc)
                log.error("Retrying after 5 s …")
                time.sleep(5)
                try:
                    response = client.embeddings.create(input=texts, model=EMBED_MODEL)
                    embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
                except Exception as exc2:
                    log.error("Retry also failed: %s — skipping batch.", exc2)
                    continue

            # Build list of (vector_str, id) for UPDATE
            update_params = [
                ("[" + ",".join(map(str, emb)) + "]", row_id)
                for emb, row_id in zip(embeddings, ids)
            ]

            with conn:
                with conn.cursor() as cur:
                    psycopg2.extras.execute_batch(cur, update_sql, update_params)

            total_done += len(batch)
            log.info(
                "  Embedded %d / %d rows (batch %d-%d) …",
                total_done, len(rows),
                batch_start + 1, batch_start + len(batch),
            )

            if EMBED_PAUSE_SEC > 0:
                time.sleep(EMBED_PAUSE_SEC)

        log.info("Phase 2 complete — %d embeddings written.", total_done)

    finally:
        conn.close()


# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import ITC(HS) CSV into PostgreSQL + embed with OpenAI text-embedding-3-small")
    parser.add_argument(
        "--phase",
        choices=["1", "2", "both"],
        default="both",
        help="1=CSV load only, 2=embed only, both=full run (default: both)",
    )
    args = parser.parse_args()

    if args.phase in ("1", "both"):
        phase1_load_csv()

    if args.phase in ("2", "both"):
        phase2_embed()

    log.info("Done.")


if __name__ == "__main__":
    main()
