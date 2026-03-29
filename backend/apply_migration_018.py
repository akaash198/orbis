"""Run migration 018: add fields_low column to m02_extraction_results."""
import sys
import os

# Ensure the backend package is on the path
sys.path.insert(0, os.path.dirname(__file__))

from Orbisporte.core import engine
from sqlalchemy import text

SQL = [
    "ALTER TABLE m02_extraction_results ADD COLUMN IF NOT EXISTS fields_low JSONB;",
    "CREATE INDEX IF NOT EXISTS idx_m02_fields_low ON m02_extraction_results USING GIN (fields_low);",
]

with engine.connect() as conn:
    for stmt in SQL:
        print(f"Running: {stmt}")
        conn.execute(text(stmt))
    conn.commit()
    print("\nMigration 018 applied successfully.")
