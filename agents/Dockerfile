FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY common/ /app/common/
COPY config/ /app/config/
COPY agents/ /app/agents/

RUN mkdir -p /app/data/eval_reports

ENV PYTHONPATH=/app

CMD ["uvicorn", "agents.crew:app", "--host", "0.0.0.0", "--port", "8003"]
