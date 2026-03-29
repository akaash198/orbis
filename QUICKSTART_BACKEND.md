# Orbisporte Backend - Quick Start

Get the backend running in 5 minutes!

## Step 1: Create Database in pgAdmin

1. Open **pgAdmin**
2. Right-click "Databases" → "Create" → "Database..."
3. Name: `orbisporte_db`
4. Click "Save"

## Step 2: Set Up Backend

Open PowerShell in the backend folder:

```powershell
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\backend"

# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create .env file
Copy-Item .env.example .env
```

## Step 3: Configure Database

Edit `.env` file:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/orbisporte_db
```
Replace `YOUR_PASSWORD` with your PostgreSQL password.

## Step 4: Initialize Database

```powershell
python init_db.py
```

You'll see:
```
✅ Database initialized successfully!
✅ Test user created successfully!
   Username: testuser
   Password: password123
```

## Step 5: Start the Server

```powershell
uvicorn Orbisporte.interfaces.api.main:app --reload
```

✨ **Done!** Backend is running on http://localhost:8000

## Verify It Works

Open browser:
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Test Login (Using Swagger UI)

1. Go to http://localhost:8000/docs
2. Find `POST /react/login`
3. Click "Try it out"
4. Enter:
   ```json
   {
     "user_name": "testuser",
     "password": "password123"
   }
   ```
5. Click "Execute"
6. Should get `access_token` and `refresh_token`!

## Now Start the Frontend

In a **new PowerShell window**:

```powershell
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\orbisporte-ui"
npm start
```

## Troubleshooting

**"Could not connect to database"**
- Check PostgreSQL is running
- Verify password in `.env`
- Ensure database `orbisporte_db` exists in pgAdmin

**"Module 'Orbisporte' not found"**
- Make sure you're in the `backend` folder
- Virtual environment is activated (you'll see `(venv)` in PowerShell prompt)

**"Port 8000 already in use"**
- Close other applications using port 8000
- Or use a different port: `uvicorn Orbisporte.interfaces.api.main:app --reload --port 8001`

## Quick Commands

**Stop the server:** Press `Ctrl + C`

**Restart the server:**
```powershell
uvicorn Orbisporte.interfaces.api.main:app --reload
```

**View logs:** Check the PowerShell window where uvicorn is running

**Check database:** Open pgAdmin → orbisporte_db → Tables

---

That's it! Backend is ready. Now you can login from the frontend! 🚀
