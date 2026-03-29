import os
from dotenv import load_dotenv

print("Testing .env loading...")
print(f"Current directory: {os.getcwd()}")
print(f".env file exists: {os.path.exists('.env')}")

load_dotenv()

db_url = os.getenv("DATABASE_URL", "NOT_FOUND")
print(f"DATABASE_URL from .env: {db_url}")

if "nexora" in db_url:
    print("✅ .env loaded correctly - using nexora user!")
else:
    print("❌ .env NOT loaded - using default value!")
