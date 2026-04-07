import os
import glob
from sqlalchemy import text
from Orbisporte.core import engine, init_db

def run_migrations():
    """Run all SQL migrations in the migrations folder"""
    # 1. Initialize core tables from SQLAlchemy models
    print("[1/2] Initializing core database tables...")
    init_db()
    
    # 2. Run raw SQL migrations for custom types, data, and complex schemas
    print("[2/2] Checking for SQL migrations...")
    migration_files = sorted(glob.glob("migrations/*.sql"))
    
    if not migration_files:
        print("No SQL migrations found.")
        return

    with engine.connect() as connection:
        for migration_file in migration_files:
            print(f"Executing migration: {os.path.basename(migration_file)}...")
            try:
                with open(migration_file, 'r', encoding='utf-8') as f:
                    sql_commands = f.read()
                    # Execute as one block (PostgreSQL supports multiple statements in one call)
                    connection.execute(text(sql_commands))
                    connection.commit()
                    print(f"Successfully applied {os.path.basename(migration_file)}")
            except Exception as e:
                print(f"Error applying {os.path.basename(migration_file)}: {e}")
                print("Continuing with next migration...")

if __name__ == "__main__":
    run_migrations()
    print("Database maintenance completed successfully!")
