FROM python:3.11-slim

WORKDIR /app

COPY services/anomaly_service/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY common/ /app/common/
COPY services/anomaly_service/ /app/services/anomaly_service/
COPY config/ /app/config/

ENV USE_ML=false
ENV PYTHONPATH=/app

CMD ["uvicorn", "services.anomaly_service.main:app", "--host", "0.0.0.0", "--port", "8001"]
