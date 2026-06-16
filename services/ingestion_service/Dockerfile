FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic python-dateutil requests python-dotenv

COPY common/ /app/common/
COPY config/ /app/config/
COPY services/ingestion_service/ /app/services/ingestion_service/

ENV PYTHONPATH=/app

CMD ["uvicorn", "services.ingestion_service.main:app", "--host", "0.0.0.0", "--port", "8002"]
