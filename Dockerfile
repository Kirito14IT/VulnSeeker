# ── Backend Dockerfile ──────────────────────────────────────────────────────────

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for aiomysql / cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY src/ ./src/
COPY data/ ./data/
COPY .env.example .env

EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "backend.main:application", "--host", "0.0.0.0", "--port", "8000"]
