FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi "uvicorn[standard]" pydantic python-dateutil python-dotenv

COPY common/ /app/common/
COPY config/ /app/config/
COPY services/incident_api/ /app/services/incident_api/

RUN mkdir -p /app/data/eval_reports

# Non-root user
RUN useradd -m -u 1000 gridops
RUN chown -R gridops:gridops /app
USER gridops

ENV PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "services.incident_api.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "2", "--log-level", "info"]
