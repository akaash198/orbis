"""
Database initialization script for Orbisporte

This script:
1. Creates all database tables
2. Creates a default test user
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from Orbisporte.core import init_db, SessionLocal
from Orbisporte.domain.models import User, Company


def create_test_user():
    """Create a test user for development"""
    db = SessionLocal()

    try:
        # Check if test user already exists
        existing_user = db.query(User).filter(User.user_name == "testuser").first()
        if existing_user:
            print("[SUCCESS] Test user already exists")
            return

        # Create test company
        company = Company(
            name="Test Company Ltd",
            gst_number="22AAAAA0000A1Z5",
            iec_number="0123456789"
        )
        db.add(company)
        db.flush()

        # Create test user
        user = User(
            first_name="Test",
            last_name="User",
            user_name="testuser",
            email_id="test@orbisporte.com",
            company_id=company.id,
            mobile_number="9876543210",
            role="customs_officer",
            location="Mumbai, India"
        )
        user.set_password("password123")
        db.add(user)
        db.commit()

        print("[SUCCESS] Test user created successfully!")
        print("   Username: testuser")
        print("   Password: password123")

    except Exception as e:
        print(f"[ERROR] Error creating test user: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("[INFO] Initializing Orbisporte database...")
    print()

    # Create tables
    init_db()

    # Create test user
    create_test_user()

    print()
    print("[SUCCESS] Database initialization complete!")
    print()
    print("[INFO] Next steps:")
    print("   1. Start the API server: uvicorn Orbisporte.interfaces.api.main:app --reload")
    print("   2. Visit http://localhost:8000/docs for API documentation")
    print("   3. Login with username: testuser, password: password123")
