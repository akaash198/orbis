# ============================================
# Orbisporte Backend Dockerfile
# ============================================
# Multi-stage build for Python FastAPI backend

# ── Stage 1: Builder ──────────────────────
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: Production ──────────────────
FROM python:3.11-slim

# Labels
LABEL maintainer="SPECTRA AI PTE. LTD."
LABEL description="Orbisporte Backend API - AI-Powered Customs Platform"
LABEL version="1.0.0"

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Create non-root user for security
RUN groupadd -r orbisporte && useradd -r -g orbisporte orbisporte

# Copy application code
COPY --chown=orbisporte:orbisporte . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/data && \
    chown -R orbisporte:orbisporte /app/uploads /app/logs /app/data

# Switch to non-root user
USER orbisporte

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    HOST=0.0.0.0

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "Orbisporte.interfaces.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
