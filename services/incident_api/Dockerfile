FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi "uvicorn[standard]" pydantic python-dateutil python-dotenv

COPY common/ /app/common/
COPY config/ /app/config/
COPY services/incident_api/ /app/services/incident_api/

# Eval reports and data are mounted as volumes in production
RUN mkdir -p /app/data/eval_reports

ENV PYTHONPATH=/app

CMD ["uvicorn", "services.incident_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
