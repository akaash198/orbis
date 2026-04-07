# Orbisporte Docker Setup

AI-Powered Indian Customs Document Processing Platform  
*SPECTRA AI PTE. LTD., Singapore*

## Table of Contents
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Services Overview](#services-overview)
- [Management Commands](#management-commands)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Windows
```batch
manage.bat
```

### Linux/Mac
```bash
chmod +x manage.sh
./manage.sh start
```

---

## Prerequisites

### Required
- [Docker](https://docs.docker.com/get-docker/) (v20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

### Recommended
- 8GB RAM minimum
- 20GB disk space

---

## Development Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Orbisporte-main
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
notepad .env  # Windows
nano .env     # Linux/Mac
```

### 3. Start Services
```bash
# Using the management script
./manage.sh start    # Linux/Mac
manage.bat          # Windows (run as administrator)

# Or using docker-compose directly
docker-compose up -d
```

### 4. Access the Application
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |
| pgAdmin (if enabled) | http://localhost:5050 |

---

## Production Setup

### 1. SSL Certificate Setup
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Option A: Let's Encrypt (recommended)
certbot --nginx -d yourdomain.com

# Option B: Self-signed (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

### 2. Configure Production Environment
```bash
# Create production .env
cp .env.example .env.prod

# Edit with production values
nano .env.prod
```

### 3. Deploy
```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d --build

# Enable monitoring (optional)
docker-compose -f docker-compose.prod.yml --profile monitoring up -d
```

---

## Services Overview

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| Frontend | orbisporte-frontend | 3000 | React app with Nginx |
| Backend | orbisporte-backend | 8000 | FastAPI application |
| PostgreSQL | orbisporte-postgres | 5432 | Primary database |
| Redis | orbisporte-redis | 6379 | Cache & sessions |
| Nginx | orbisporte-nginx | 80/443 | Reverse proxy (prod) |

---

## Management Commands

### Start Services
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### Stop Services
```bash
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Rebuild Images
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up
```bash
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove all unused data
docker system prune -a -f --volumes
```

---

## Environment Variables

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `orbisporte` |
| `POSTGRES_USER` | Database user | `orbisporte` |
| `POSTGRES_PASSWORD` | Database password | *(set your own)* |
| `REDIS_PASSWORD` | Redis password | *(set your own)* |
| `SECRET_KEY` | Application secret key | *(set your own)* |
| `JWT_SECRET` | JWT signing secret | *(set your own)* |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | *(empty)* |
| `VOYAGE_API_KEY` | Voyage AI API key | *(empty)* |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `LOG_LEVEL` | Logging level | `INFO` |

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker-compose logs <service-name>
```

**Common issues:**
1. Port already in use - change port mapping in docker-compose.yml
2. Volume permissions - run `sudo chown -R 1000:1000 ./data ./uploads`
3. Missing .env file - run `cp .env.example .env`

### Database Connection Issues

**Check if PostgreSQL is healthy:**
```bash
docker-compose ps postgres
```

**Test connection:**
```bash
docker-compose exec postgres psql -U orbisporte -d orbisporte
```

### Build Failures

**Clear Docker cache:**
```bash
docker-compose down
docker system prune -a -f
docker-compose build --no-cache
docker-compose up -d
```

### Performance Issues

**Check resource usage:**
```bash
docker stats
```

**Increase memory in Docker Desktop settings:**
- Windows: Docker Desktop > Settings > Resources
- Mac: Docker Desktop > Preferences > Resources

### View Container Shell
```bash
docker-compose exec backend bash
docker-compose exec postgres psql -U orbisporte -d orbisporte
```

---

## Docker Commands Reference

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start all services in background |
| `docker-compose down` | Stop all services |
| `docker-compose restart <service>` | Restart a specific service |
| `docker-compose logs -f <service>` | Follow logs |
| `docker-compose exec <service> <command>` | Execute command in container |
| `docker-compose build` | Build images |
| `docker-compose ps` | List running containers |
| `docker-compose top` | Show running processes |

---

## SSL Setup for Production

### Option 1: Let's Encrypt (Recommended)

```bash
# Install certbot
# Windows: Use Docker certbot image
docker run -it --rm \
  -v $(pwd)/nginx/ssl:/etc/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly --standalone

# Copy certificates
cp -r /etc/letsencrypt/live/yourdomain.com/* nginx/ssl/
```

### Option 2: Commercial SSL

Place your certificates in:
```
nginx/ssl/
├── cert.pem
├── key.pem
└── chain.pem
```

---

## Monitoring

### Enable Monitoring
```bash
docker-compose --profile monitoring up -d
```

### Access
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

---

## License

Copyright (c) 2024 SPECTRA AI PTE. LTD., Singapore
