"""
Run Migration 014: M06 Trade Fraud Detection Engine Tables
Run this script to create the fraud detection database schema.
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

        migration_file = 'migrations/014_m06_fraud_engine.sql'
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

        print("Migration 014 completed successfully!")
        print("")
        print("Tables created:")
        print("   - m06_fraud_analyses")
        print("   - m06_fraud_flags")
        print("   - m06_investigation_cases")

    except Exception as e:
        print(f"Migration failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("  M06 TRADE FRAUD DETECTION ENGINE — MIGRATION 014")
    print("=" * 60)
    print("")
    run_migration()
