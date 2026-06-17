FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY common/ /app/common/
COPY config/ /app/config/
COPY agents/ /app/agents/
COPY data/ /app/data/

RUN mkdir -p /app/data/eval_reports /app/data/maintenance

# Non-root user
RUN useradd -m -u 1000 gridops
RUN chown -R gridops:gridops /app
USER gridops

ENV PYTHONPATH=/app

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8003/health')"

# Single worker — CrewAI runs synchronous LLM calls; concurrency via replicas
CMD ["uvicorn", "agents.crew:app", \
     "--host", "0.0.0.0", "--port", "8003", \
     "--workers", "1", "--log-level", "info"]
