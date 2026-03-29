"""
Run Migration 015: M07 Risk Score Engine Tables
Run this script to create the risk scoring database schema.
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def run_migration():
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    print("Connecting to database...")

    try:
        engine = create_engine(database_url)

        migration_file = 'migrations/015_m07_risk_engine.sql'
        if not os.path.exists(migration_file):
            print(f"ERROR: Migration file not found: {migration_file}")
            sys.exit(1)

        print(f"Reading migration: {migration_file}")
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        print("Running migration...")
        with engine.connect() as conn:
            conn.execute(text(sql_content))
            conn.commit()

        print("Migration 015 completed successfully!")
        print("")
        print("Tables created:")
        print("   - m07_risk_scores")
        print("   - m07_review_queue")

    except Exception as e:
        print(f"Migration failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("  M07 RISK SCORE ENGINE — MIGRATION 015")
    print("=" * 60)
    print("")
    run_migration()
