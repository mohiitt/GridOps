FROM python:3.11-slim

WORKDIR /app

# System deps for confluent-kafka (librdkafka)
RUN apt-get update && apt-get install -y --no-install-recommends \
    librdkafka-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir \
    fastapi "uvicorn[standard]" pydantic python-dateutil \
    requests python-dotenv "confluent-kafka>=2.3" numpy

COPY common/ /app/common/
COPY config/ /app/config/
COPY services/ingestion_service/ /app/services/ingestion_service/

# Non-root user for security
RUN useradd -m -u 1000 gridops
RUN chown -R gridops:gridops /app
USER gridops

ENV PYTHONPATH=/app

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')"

CMD ["uvicorn", "services.ingestion_service.main:app", \
     "--host", "0.0.0.0", "--port", "8002", \
     "--workers", "1", "--log-level", "info"]
