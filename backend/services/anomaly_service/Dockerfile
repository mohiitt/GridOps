FROM python:3.11-slim

WORKDIR /app

COPY services/anomaly_service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY common/ /app/common/
COPY services/anomaly_service/ /app/services/anomaly_service/
COPY config/ /app/config/

# Non-root user
RUN useradd -m -u 1000 gridops
RUN chown -R gridops:gridops /app
USER gridops

ENV USE_ML=false
ENV PYTHONPATH=/app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"

CMD ["uvicorn", "services.anomaly_service.main:app", \
     "--host", "0.0.0.0", "--port", "8001", \
     "--workers", "2", "--log-level", "info"]
