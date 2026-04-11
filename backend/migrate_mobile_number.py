"""
Migration: Update mobile_number column to support international format
"""
from sqlalchemy import text
from Orbisporte.core import engine

def migrate():
    with engine.connect() as conn:
        try:
            # Alter the mobile_number column to increase length
            conn.execute(text('''
                ALTER TABLE "User"
                ALTER COLUMN mobile_number TYPE VARCHAR(20);
            '''))
            conn.commit()
            print("✅ Migration successful: mobile_number column updated to VARCHAR(20)")
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate()
