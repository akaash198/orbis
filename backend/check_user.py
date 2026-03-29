import psycopg2
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(override=True)

# Connect to database
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:admin@localhost:5432/orbisporte_db')

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Check for testuser
    cur.execute('SELECT id, user_name, email_id, first_name, last_name, password_hash FROM "User" WHERE user_name = \'testuser\'')
    user = cur.fetchone()

    if user:
        print(f"User found:")
        print(f"  ID: {user[0]}")
        print(f"  Username: {user[1]}")
        print(f"  Email: {user[2]}")
        print(f"  First Name: {user[3]}")
        print(f"  Last Name: {user[4]}")
        print(f"  Password hash exists: {bool(user[5])}")
        print(f"  Password hash (first 30 chars): {user[5][:30] if user[5] else 'None'}...")
    else:
        print("User NOT found")

    # List all users
    print("\nAll users in database:")
    cur.execute('SELECT user_name, email_id FROM "User"')
    all_users = cur.fetchall()
    if all_users:
        for u in all_users:
            print(f"  - {u[0]} ({u[1]})")
    else:
        print("  No users in database")

    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
