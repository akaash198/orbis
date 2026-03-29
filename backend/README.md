# Orbisporte Backend API

FastAPI backend for the Orbisporte Indian Customs platform.

## Features

- ✅ User authentication (JWT with refresh tokens)
- ✅ Document upload and management
- ✅ GST number validation
- ✅ IEC code validation
- ✅ HS Code lookup (ready for AI integration)
- ✅ PostgreSQL database with SQLAlchemy
- ✅ CORS enabled for React frontend
- ✅ RESTful API design

## Prerequisites

- Python 3.10 or higher
- PostgreSQL database
- pip (Python package manager)

## Quick Start

### 1. Set up PostgreSQL Database

Open pgAdmin and create a new database:

```sql
CREATE DATABASE orbisporte_db;
```

Or use psql:
```bash
createdb orbisporte_db
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
copy .env.example .env
```

Edit `.env` and update the database URL if needed:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/orbisporte_db
```

### 4. Initialize Database

```bash
python init_db.py
```

This will:
- Create all database tables
- Create a test user (username: `testuser`, password: `password123`)

### 5. Start the API Server

```bash
uvicorn Orbisporte.interfaces.api.main:app --reload
```

The API will be available at:
- **API**: http://localhost:8000
- **Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Authentication

- `POST /react/login` - User login
- `POST /react/signup` - User registration
- `POST /react/refresh-token` - Refresh access token
- `POST /react/logout` - Logout user

### Documents

- `POST /react/upload-document` - Upload document
- `GET /react/documents` - Get all user documents
- `GET /react/documents/{id}` - Get specific document
- `DELETE /react/documents/{id}` - Delete document
- `POST /react/classify-document` - Classify document type
- `POST /react/extract-data` - Extract data from document

### Indian Customs

- `POST /react/hscode-lookup` - Look up HS Code
- `POST /react/validate-gst` - Validate GST number
- `POST /react/validate-iec` - Validate IEC number
- `POST /react/generate-customs-declaration` - Generate declaration

### Dashboard

- `GET /react/dashboard/stats` - Get dashboard statistics

## Database Schema

### Tables

**Company**
- `id`: Primary key
- `name`: Company name
- `gst_number`: GST identification (15 chars)
- `iec_number`: Import Export Code (10 digits)

**User**
- `id`: Primary key
- `first_name`, `last_name`: User name
- `user_name`: Unique username
- `email_id`: Unique email
- `password_hash`: Bcrypt hashed password
- `company_id`: Foreign key to Company
- `mobile_number`: 10-digit mobile
- `role`: User role (customs_officer, importer, exporter, etc.)
- `location`: City/location

**ProcessedDocument**
- `id`: Primary key
- `user_id`: Foreign key to User
- `filename`: Stored filename
- `original_filename`: Original uploaded name
- `file_path`: Path on disk
- `doc_type`: Classified type (invoice, bill_of_entry, etc.)
- `extracted_data`: JSON field with extracted information
- `hs_code`: Harmonized System code
- `gst_number`, `iec_number`: Indian customs codes
- `processing_status`: uploaded, classified, extracted, completed
- `content_hash`: SHA-256 hash for duplicate detection

**RefreshToken**
- `id`: Primary key
- `user_id`: Foreign key to User
- `token`: Refresh token string
- `expires_at`: Expiration datetime
- `revoked`: 0 = active, 1 = revoked

## Project Structure

```
backend/
├── Orbisporte/
│   ├── __init__.py
│   ├── core.py                    # Database engine & base
│   ├── domain/
│   │   ├── models.py              # SQLAlchemy models
│   │   └── services/              # Business logic (future)
│   ├── infrastructure/
│   │   ├── db.py                  # Repository pattern
│   │   └── file_storage.py        # File upload handling
│   ├── interfaces/
│   │   └── api/
│   │       ├── main.py            # FastAPI app
│   │       ├── routes.py          # API endpoints
│   │       ├── schemas.py         # Pydantic models
│   │       └── auth.py            # JWT authentication
│   └── prompts/                   # AI prompts (future)
├── init_db.py                     # Database setup script
├── requirements.txt
├── .env.example
└── README.md
```

## Testing the API

### Using Swagger UI

1. Go to http://localhost:8000/docs
2. Click "Authorize" button
3. Login to get token:
   - Username: `testuser`
   - Password: `password123`
4. Copy the `access_token` from response
5. Click "Authorize" and paste: `Bearer YOUR_TOKEN_HERE`
6. Now you can test all endpoints!

### Using curl

**Login:**
```bash
curl -X POST "http://localhost:8000/react/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_name\":\"testuser\",\"password\":\"password123\"}"
```

**Upload Document:**
```bash
curl -X POST "http://localhost:8000/react/upload-document" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

**Validate GST:**
```bash
curl -X POST "http://localhost:8000/react/validate-gst" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"gst_number\":\"22AAAAA0000A1Z5\"}"
```

## Development

### Create a New User

```python
from Orbisporte.core import SessionLocal
from Orbisporte.infrastructure.db import UserRepository

db = SessionLocal()
user = UserRepository.create_user(
    db,
    first_name="John",
    last_name="Doe",
    user_name="johndoe",
    email_id="john@example.com",
    password="securepassword",
    role="importer"
)
```

### Query Documents

```python
from Orbisporte.infrastructure.db import DocumentRepository

documents = DocumentRepository.get_user_documents(db, user_id=1)
```

## Security

- ✅ Passwords hashed with bcrypt
- ✅ JWT access tokens (30 min expiry)
- ✅ Refresh tokens (30 days expiry)
- ✅ Token revocation support
- ✅ CORS configuration
- ⚠️ Change `JWT_SECRET_KEY` in production!

## Troubleshooting

**Database connection error:**
- Check PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Ensure database `orbisporte_db` exists

**Import errors:**
- Make sure you're in the `backend` directory
- Check all dependencies installed: `pip install -r requirements.txt`

**Port already in use:**
```bash
# Use different port
uvicorn Orbisporte.interfaces.api.main:app --reload --port 8001
```

## Future Enhancements

- [ ] AI document classification (GPT-4)
- [ ] OCR for scanned documents
- [ ] Real HS Code API integration
- [ ] ICEGATE portal integration
- [ ] Barcode/QR scanning
- [ ] Email notifications
- [ ] Celery for async tasks
- [ ] Redis caching

## License

MIT License

---

Built with ⚡ for Indian Customs by the Orbisporte Team
