# Orbisporte Complete Setup Guide

Step-by-step guide to get Orbisporte (Indian Customs platform) running on your machine.

## Prerequisites

Before you begin, ensure you have:

- ✅ **Python 3.10+** - [Download](https://www.python.org/downloads/)
- ✅ **Node.js 16+** - [Download](https://nodejs.org/)
- ✅ **PostgreSQL** - [Download](https://www.postgresql.org/download/)
- ✅ **pgAdmin** (optional but recommended) - Usually comes with PostgreSQL

## Part 1: Database Setup (PostgreSQL)

### Option A: Using pgAdmin (Recommended)

1. **Open pgAdmin**
2. **Connect to your PostgreSQL server**
   - Default username: `postgres`
   - Enter your password (set during PostgreSQL installation)

3. **Create the database:**
   - Right-click on "Databases"
   - Select "Create" → "Database..."
   - Database name: `orbisporte_db`
   - Click "Save"

### Option B: Using Command Line

```bash
# Windows (Command Prompt or PowerShell)
createdb -U postgres orbisporte_db

# Linux/Mac
createdb orbisporte_db
```

## Part 2: Backend Setup

### 1. Navigate to Backend Directory

```bash
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\backend"
```

### 2. Create Virtual Environment

```bash
python -m venv venv
```

### 3. Activate Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI (web framework)
- SQLAlchemy (database ORM)
- psycopg2 (PostgreSQL driver)
- PyJWT (authentication)
- bcrypt (password hashing)
- and more...

### 5. Configure Environment

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

**Edit `.env` file:**

Open `.env` in a text editor and update:
```
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/orbisporte_db
```

Replace `YOUR_POSTGRES_PASSWORD` with your PostgreSQL password.

### 6. Initialize Database

```bash
python init_db.py
```

This will:
- ✅ Create all database tables
- ✅ Create a test user:
  - Username: `testuser`
  - Password: `password123`
- ✅ Create a test company

### 7. Start Backend Server

```bash
uvicorn Orbisporte.interfaces.api.main:app --reload
```

**Or use the startup script:**

Windows:
```bash
start.bat
```

Linux/Mac:
```bash
chmod +x startup.sh
./startup.sh
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Verify it's working:**
- Open browser: http://localhost:8000/docs
- You should see the Swagger API documentation

## Part 3: Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\orbisporte-ui"
```

### 2. Install Dependencies (if not done)

```bash
npm install
```

### 3. Create .env File

```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

The `.env` should contain:
```
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_NAME=Orbisporte
REACT_APP_TAGLINE=AI-Powered Indian Customs Platform
```

### 4. Start Frontend

```bash
npm start
```

**Expected output:**
```
Compiled successfully!

You can now view orbisporte-ui in the browser.

  Local:            http://localhost:3001
  On Your Network:  http://192.168.x.x:3001
```

Browser should automatically open to http://localhost:3001

## Part 4: Test the Application

### 1. Frontend Login

On the landing page:
1. **Click "Sign up here"** to create a new account, OR
2. **Use test credentials:**
   - Username: `testuser`
   - Password: `password123`

### 2. After Login

You'll see:
- ✅ **Dashboard** with statistics
- ✅ **Documents** panel for uploads
- ✅ **HS Code** lookup tool
- ✅ **Customs** panel (GST/IEC validation)
- ✅ **Q&A** chatbot interface
- ✅ **Settings** panel

### 3. Test Document Upload

1. Go to **Documents** panel
2. Click **"Upload Document"**
3. Select a PDF, JPG, or PNG file
4. File uploads successfully!

### 4. Test GST Validation

1. Go to **Customs** panel
2. Enter a GST number: `22AAAAA0000A1Z5`
3. Click **"Validate GST"**
4. Should show: ✅ Valid GST Number

### 5. Test IEC Validation

1. In **Customs** panel
2. Enter IEC number: `0123456789`
3. Click **"Validate IEC"**
4. Should show: ✅ Valid IEC Number

## Quick Reference

### Database Access (pgAdmin)

1. **Open pgAdmin**
2. **Navigate to:**
   - Servers → PostgreSQL → Databases → orbisporte_db → Schemas → public → Tables

3. **View data:**
   - Right-click on "User" table
   - Select "View/Edit Data" → "All Rows"

### API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Stop the Services

**Backend:**
- Press `Ctrl + C` in the terminal running uvicorn

**Frontend:**
- Press `Ctrl + C` in the terminal running npm

## Troubleshooting

### Backend Issues

**"Could not connect to database"**
- Check PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Test connection in pgAdmin

**"Module not found"**
- Make sure virtual environment is activated
- Run `pip install -r requirements.txt` again

**Port 8000 already in use**
```bash
uvicorn Orbisporte.interfaces.api.main:app --reload --port 8001
```
Then update frontend `.env`: `REACT_APP_API_BASE_URL=http://localhost:8001`

### Frontend Issues

**"Cannot connect to backend"**
- Ensure backend is running on port 8000
- Check `.env` has correct API URL
- Verify CORS settings in backend

**Port 3000/3001 already in use**
- npm will ask to use another port
- Type `Y` and press Enter

**Compilation errors**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## Project Structure

```
Orbisporte/
├── backend/
│   ├── Orbisporte/              # Backend source code
│   │   ├── domain/              # Models & business logic
│   │   ├── infrastructure/      # Database & file storage
│   │   ├── interfaces/api/      # FastAPI routes
│   │   └── core.py              # Database engine
│   ├── init_db.py               # Database setup script
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # Environment config
│   └── start.bat                # Startup script (Windows)
│
├── orbisporte-ui/               # React frontend
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── contexts/            # Auth & state management
│   │   ├── services/            # API integration
│   │   └── styles/              # Themes & styling
│   ├── package.json             # Node dependencies
│   └── .env                     # Frontend config
│
├── README.md                    # Main project readme
└── SETUP_GUIDE.md              # This file
```

## Next Steps

### Add More Users

1. Go to http://localhost:3001
2. Click "Sign up here"
3. Fill in the form with your details
4. Create account!

### Explore API

1. Visit http://localhost:8000/docs
2. Click "Authorize"
3. Login with test user
4. Try different endpoints!

### View Database

1. Open pgAdmin
2. Navigate to tables
3. View data in User, Company, ProcessedDocuments tables

## Database Schema

**User Table:**
- id, first_name, last_name, user_name, email_id
- password_hash (bcrypt hashed)
- mobile_number, role, location
- company_id (foreign key)

**Company Table:**
- id, name, gst_number, iec_number

**ProcessedDocuments Table:**
- id, user_id, filename, file_path
- doc_type, extracted_data (JSON)
- hs_code, gst_number, iec_number
- processing_status

**RefreshTokens Table:**
- id, user_id, token
- expires_at, revoked

## Success Checklist

- [ ] PostgreSQL running & database created
- [ ] Backend virtual environment created & activated
- [ ] Python dependencies installed
- [ ] Database initialized with tables
- [ ] Backend API running on port 8000
- [ ] API docs accessible at /docs
- [ ] Frontend dependencies installed
- [ ] Frontend running on port 3001
- [ ] Can login with test user
- [ ] Can upload documents
- [ ] Can validate GST/IEC numbers

## Need Help?

- Check backend `README.md` for API details
- Check frontend `README.md` for UI details
- Review error messages carefully
- Ensure all services are running

---

**Congratulations!** 🎉

You now have a fully functional Indian Customs document processing platform!

Built with ⚡ for Indian Customs
