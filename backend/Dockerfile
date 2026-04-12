FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local /usr/local

RUN groupadd -r orbisporte && useradd -r -g orbisporte orbisporte

COPY --chown=orbisporte:orbisporte . .

RUN mkdir -p /app/uploads /app/logs /app/data \
  && chown -R orbisporte:orbisporte /app/uploads /app/logs /app/data

USER orbisporte

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "Orbisporte.interfaces.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

