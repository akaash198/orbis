"""
Create orbisporte_db database in PostgreSQL
This script creates the database if it doesn't exist
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys

# Database connection parameters
# Using postgres superuser to create database (not nexora)
DB_HOST = "localhost"
DB_PORT = "5432"
DB_USER = "postgres"  # Use postgres superuser to create database
DB_PASSWORD = "postgres"
DB_NAME = "orbisporte_db"

print("Creating Orbisporte database...")
print()

try:
    # Connect to PostgreSQL server (to default 'postgres' database)
    print(f"Connecting to PostgreSQL server as user '{DB_USER}'...")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database="postgres"  # Connect to default database first
    )

    # Set isolation level for database creation
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    # Check if database exists
    print(f"Checking if database '{DB_NAME}' exists...")
    cursor.execute(
        "SELECT 1 FROM pg_database WHERE datname = %s",
        (DB_NAME,)
    )
    exists = cursor.fetchone()

    if exists:
        print(f"Database '{DB_NAME}' already exists!")
    else:
        # Create database
        print(f"Creating database '{DB_NAME}'...")
        cursor.execute(f'CREATE DATABASE {DB_NAME}')
        print(f"Database '{DB_NAME}' created successfully!")

    # Grant permissions
    print(f"Setting up permissions for user '{DB_USER}'...")
    cursor.execute(f'GRANT ALL PRIVILEGES ON DATABASE {DB_NAME} TO {DB_USER}')

    cursor.close()
    conn.close()

    print()
    print("Database setup complete!")
    print()
    print("Next step: Run 'python init_db.py' to create tables")
    print()

except psycopg2.OperationalError as e:
    print(f"Connection Error: {e}")
    print()
    print("💡 Possible issues:")
    print("   1. PostgreSQL is not running")
    print("   2. User 'nexora' doesn't exist")
    print("   3. Password 'admin' is incorrect")
    print()
    print("🔧 Try this in pgAdmin:")
    print("   1. Open pgAdmin")
    print("   2. Right-click 'Databases' → Create → Database")
    print("   3. Name: orbisporte_db")
    print("   4. Owner: nexora")
    print()
    sys.exit(1)

except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
