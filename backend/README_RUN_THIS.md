# 🚀 Orbisporte Backend - START HERE

## What I Fixed

✅ **Fixed the .env loading issue** - Now explicitly loads from the correct location
✅ **Created complete FastAPI backend** with all Indian Customs features
✅ **Setup scripts ready** - One command to set everything up

---

## Quick Start (3 Steps)

### Step 1: Make Sure PostgreSQL is Running

1. Open **pgAdmin**
2. Check if `orbisporte_db` database exists
3. If NOT, create it:
   - Right-click "Databases" → "Create" → "Database..."
   - Name: `orbisporte_db`
   - Owner: `nexora` (or `postgres` if `nexora` doesn't exist)
   - Click "Save"

### Step 2: Run Setup Script

**Option A - PowerShell (Recommended):**
```powershell
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\backend"
.\setup.ps1
```

**Option B - Command Prompt:**
```cmd
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\backend"
setup.bat
```

This will:
- ✅ Activate virtual environment
- ✅ Create database (if needed)
- ✅ Create all tables
- ✅ Create test user (username: `testuser`, password: `password123`)

### Step 3: Start the API Server

```powershell
uvicorn Orbisporte.interfaces.api.main:app --reload
```

You'll see:
```
🔧 Loading .env from: C:\Users\sneha\OneDrive\Desktop\Orbisporte`\backend\.env
📊 DATABASE_URL: postgresql://nexora:admin@localhost:5432/orbisporte_db
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## Verify It Works

1. **Open browser**: http://localhost:8000/docs
2. **Test the login endpoint**:
   - Click `POST /react/login` → "Try it out"
   - Enter:
     ```json
     {
       "user_name": "testuser",
       "password": "password123"
     }
     ```
   - Click "Execute"
   - Should get access_token! ✅

---

## Troubleshooting

### "Password authentication failed for user nexora"

The .env file uses `nexora` user. If this user doesn't exist in your PostgreSQL:

**Fix 1 - Create nexora user in pgAdmin:**
1. Open pgAdmin
2. Right-click "Login/Group Roles" → "Create" → "Login/Group Role..."
3. General tab: Name = `nexora`
4. Definition tab: Password = `admin`
5. Privileges tab: Check "Can login?" and "Superuser?"
6. Click "Save"

**Fix 2 - Use postgres user instead:**
Edit `.env` file:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/orbisporte_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
```
Replace `YOUR_PASSWORD` with your PostgreSQL password.

### "Module not found"

Make sure virtual environment is activated:
```powershell
.\venv\Scripts\Activate.ps1
```
You should see `(venv)` in your prompt.

### "Port 8000 already in use"

```powershell
uvicorn Orbisporte.interfaces.api.main:app --reload --port 8001
```
Then update frontend `.env`: `REACT_APP_API_BASE_URL=http://localhost:8001`

---

## What's in the Backend?

```
backend/
├── Orbisporte/
│   ├── interfaces/api/
│   │   ├── main.py          # FastAPI app
│   │   ├── routes.py        # All endpoints (login, documents, GST/IEC, HS Code)
│   │   ├── auth.py          # JWT authentication
│   │   └── schemas.py       # Request/response models
│   ├── domain/
│   │   └── models.py        # Database models (User, Company, ProcessedDocument)
│   └── core.py              # Database connection (FIXED!)
├── .env                     # Configuration (FIXED!)
├── init_db.py               # Initialize database
├── setup.ps1 / setup.bat    # Setup scripts
└── requirements.txt         # Dependencies
```

---

## Backend API Endpoints

All endpoints available at http://localhost:8000/docs:

**Authentication:**
- `POST /react/signup` - Create new account
- `POST /react/login` - Login and get tokens
- `POST /react/refresh` - Refresh access token

**Documents:**
- `POST /react/upload` - Upload document
- `GET /react/documents` - List all documents
- `DELETE /react/documents/{id}` - Delete document

**Indian Customs:**
- `POST /react/validate-gst` - Validate GST number
- `POST /react/validate-iec` - Validate IEC number
- `GET /react/hscode-lookup` - HS Code lookup

**User:**
- `GET /react/user/profile` - Get user profile
- `GET /react/user/stats` - Get statistics

---

## Success Checklist

- [ ] PostgreSQL running & `orbisporte_db` exists
- [ ] Setup script completed successfully
- [ ] Test user created
- [ ] API server running on port 8000
- [ ] Can access http://localhost:8000/docs
- [ ] Can login with testuser/password123
- [ ] Frontend can connect to backend

---

## Next Step

**Start the Frontend:**

In a NEW PowerShell window:
```powershell
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\orbisporte-ui"
npm start
```

Then login at http://localhost:3001 with:
- Username: `testuser`
- Password: `password123`

---

🎉 **You're all set!** Backend API is ready for Indian Customs document processing!
