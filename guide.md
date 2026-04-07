# Orbis - AI-Powered Customs Document Processing Platform

*A product of SPECTRA AI PTE. LTD., Singapore*

---

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/akaash198/orbis.git
cd orbis
```

### 2. Setup Environment
```bash
# Copy environment template
cp .env.example .env
```

### 3. Configure Environment
Edit the `.env` file and set the following required values:
```env
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password
SECRET_KEY=your_secret_key_here_min_32_chars
JWT_SECRET=your_jwt_secret_here_min_32_chars
```

### 4. Start with Docker
```bash
# Windows
manage.bat

# Linux/Mac
chmod +x manage.sh
./manage.sh start
```

---

## Access Services

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Docker Management Commands

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f
docker-compose logs -f backend    # Backend only
docker-compose logs -f frontend  # Frontend only
```

### Rebuild Images
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up
```bash
docker-compose down -v           # Remove volumes
docker system prune -a -f       # Remove unused images
```

---

## Manual Setup (Without Docker)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate      # Windows
source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations (if any)
# python manage.py migrate

# Start server
uvicorn Orbisporte.interfaces.api.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd orbisporte-ui

# Install dependencies
npm install

# Start development server
npm start
```

---

## Environment Variables

### Required Variables
| Variable | Description |
|----------|-------------|
| `POSTGRES_DB` | Database name (default: orbisporte) |
| `POSTGRES_USER` | Database user (default: orbisporte) |
| `POSTGRES_PASSWORD` | Database password |
| `REDIS_PASSWORD` | Redis password |
| `SECRET_KEY` | Application secret key (min 32 chars) |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |

### Optional Variables
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for LLM features |
| `VOYAGE_API_KEY` | Voyage AI API key for embeddings |
| `CORS_ORIGINS` | Allowed CORS origins (default: *) |
| `LOG_LEVEL` | Logging level (default: INFO) |

---

## Project Structure

```
orbis/
├── backend/                    # FastAPI Backend
│   ├── Dockerfile              # Backend container image
│   ├── Orbisporte/             # Main application
│   │   ├── interfaces/api/     # API routes
│   │   ├── domain/             # Business logic
│   │   └── infrastructure/     # DB, cache, storage
│   └── requirements.txt        # Python dependencies
│
├── orbisporte-ui/              # React Frontend
│   ├── Dockerfile              # Frontend container image
│   ├── nginx.conf              # Nginx configuration
│   └── src/
│       ├── components/         # React components
│       ├── services/           # API services
│       └── styles/             # Styling
│
├── docker-compose.yml          # Development compose
├── docker-compose.prod.yml     # Production compose
├── .env.example               # Environment template
├── manage.sh / manage.bat      # Docker management scripts
├── init-scripts/               # Database initialization
├── nginx/                      # Production nginx config
└── monitoring/                  # Prometheus/Grafana config
```

---

## Services Overview

| Service | Container | Ports | Description |
|---------|-----------|-------|-------------|
| Frontend | orbisporte-frontend | 3000 | React app + Nginx |
| Backend | orbisporte-backend | 8000 | FastAPI application |
| PostgreSQL | orbisporte-postgres | 5432 | Database with pgvector |
| Redis | orbisporte-redis | 6379 | Cache & sessions |
| Nginx | orbisporte-nginx | 80, 443 | Reverse proxy (prod) |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/react/login` | User login |
| POST | `/react/signup` | User signup |
| POST | `/react/refresh-token` | Refresh token |
| GET | `/react/validate-token` | Validate token |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/react/upload-document` | Upload document |
| GET | `/react/documents` | List documents |
| GET | `/react/documents/{id}` | Get document |
| POST | `/react/classify` | Classify document |
| POST | `/react/extract` | Extract data |

### Modules
| Module | Endpoints |
|--------|-----------|
| M02 | Document Extraction |
| M03 | HSN Classification |
| M04 | Duty Computation |
| M05 | Bill of Entry |
| M06 | Fraud Detection |
| M07 | Risk Scoring |

Full API documentation available at `/docs`

---

## Troubleshooting

### Container Won't Start
1. Check logs: `docker-compose logs <service>`
2. Verify `.env` file exists
3. Check port availability: `netstat -an | grep 3000`

### Database Connection Failed
```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U orbisporte -d orbisporte
```

### Build Failures
```bash
# Clear Docker cache
docker system prune -a -f
docker-compose build --no-cache
docker-compose up -d
```

### Permission Issues (Linux/Mac)
```bash
sudo chown -R 1000:1000 ./backend/uploads ./backend/logs
```

---

## Production Deployment

### 1. SSL Certificate Setup
```bash
mkdir -p nginx/ssl

# Let's Encrypt (recommended)
certbot --nginx -d yourdomain.com

# Or self-signed for testing
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

### 2. Configure Production Environment
```bash
cp .env.example .env
# Set production values
```

### 3. Deploy
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

---

## License

Copyright (c) 2024 SPECTRA AI PTE. LTD., Singapore
