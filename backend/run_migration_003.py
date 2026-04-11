"""
Run Migration 003: Bill of Entry Tables
Run this script to create the BoE database schema
"""

import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration():
    """Run the Bill of Entry migration"""

    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL')

    if not database_url:
        print("ERROR: DATABASE_URL not found in .env file")
        sys.exit(1)

    print(f"🔗 Connecting to database...")

    try:
        # Create engine
        engine = create_engine(database_url)

        # Read migration file
        migration_file = 'migrations/003_bill_of_entry_tables.sql'

        if not os.path.exists(migration_file):
            print(f"ERROR: Migration file not found: {migration_file}")
            sys.exit(1)

        print(f"📄 Reading migration: {migration_file}")

        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Execute migration
        print(f"🚀 Running migration...")

        with engine.connect() as conn:
            # Execute the entire SQL file
            conn.execute(text(sql_content))
            conn.commit()

        print("✅ Migration completed successfully!")
        print("")
        print("📋 Tables created:")
        print("   - bills_of_entry")
        print("   - boe_line_items")
        print("   - boe_versions")
        print("   - boe_validation_rules")
        print("   - port_configurations")
        print("")
        print("🎉 Module 3: Bill of Entry is ready to use!")

    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        print("")
        print("Troubleshooting:")
        print("1. Check that DATABASE_URL is correct in .env")
        print("2. Ensure PostgreSQL is running")
        print("3. Verify database exists and you have permissions")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 70)
    print("  MODULE 3: BILL OF ENTRY MIGRATION")
    print("=" * 70)
    print("")

    run_migration()
