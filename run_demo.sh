#!/bin/bash

# Exit on error, uninitialized variables, and piping errors
set -euo pipefail

echo "=== GridOps Copilot: Full-Stack Live Demo Starter ==="

# Check for .env file
if [ ! -f .env ]; then
  echo "Error: Root .env file not found!"
  echo "Please run: cp .env.example .env"
  echo "Then set TFY_GATEWAY_BASE_URL and TFY_API_KEY in the .env file."
  exit 1
fi

# Ensure frontend config is in live mode
echo "Configuring frontend to use live API..."
mkdir -p frontend
echo "NEXT_PUBLIC_USE_LIVE_API=true" > frontend/.env.local

# Virtual Environment Setup & Validation
VENV_DIR=".venv"

if [ -d "$VENV_DIR" ]; then
  # Check if python inside the venv is compatible (3.10 to 3.13)
  if ! "$VENV_DIR/bin/python" -c 'import sys; exit(0) if (sys.version_info.major == 3 and sys.version_info.minor >= 10 and sys.version_info.minor < 14) else exit(1)' &>/dev/null; then
    echo "Found existing virtual environment, but it uses an incompatible Python version. Recreating..."
    rm -rf "$VENV_DIR"
  fi
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Virtual environment not found. Checking for compatible Python interpreter (Requires >=3.10, <3.14)..."
  
  PYTHON_CMD=""
  # Search candidates in priority order
  for cmd in python3.12 python3.11 python3.10 python3; do
    if command -v "$cmd" &> /dev/null; then
      # Query major/minor version
      VERSION=$("$cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
      MAJOR=$(echo "$VERSION" | cut -d. -f1)
      MINOR=$(echo "$VERSION" | cut -d. -f2)
      if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 10 ] && [ "$MINOR" -lt 14 ]; then
        PYTHON_CMD="$cmd"
        break
      fi
    fi
  done

  if [ -z "$PYTHON_CMD" ]; then
    echo "Error: No compatible Python version found (CrewAI requires Python >= 3.10 and < 3.14)."
    if command -v python3 &> /dev/null; then
      echo "System python3 is $(python3 --version), which is not supported by CrewAI."
    fi
    echo "Please install Python 3.12 (e.g., 'brew install python@3.12') and try again."
    exit 1
  fi

  echo "Creating virtual environment using $PYTHON_CMD ($($PYTHON_CMD --version))..."
  "$PYTHON_CMD" -m venv "$VENV_DIR"
  echo "Virtual environment created at $VENV_DIR"
  
  echo "Installing Python dependencies (requirements.txt)..."
  "$VENV_DIR/bin/pip" install --upgrade pip
  "$VENV_DIR/bin/pip" install -r requirements.txt
else
  echo "Found existing virtual environment at $VENV_DIR"
  # Check if requirements are installed (try to import numpy)
  if ! "$VENV_DIR/bin/python" -c 'import numpy' &>/dev/null; then
    echo "Dependencies are missing in virtual environment. Running pip install..."
    "$VENV_DIR/bin/pip" install --upgrade pip
    "$VENV_DIR/bin/pip" install -r requirements.txt
  fi
fi

# Generate synthetic data using the venv python
echo "Generating synthetic data..."
"$VENV_DIR/bin/python" scripts/generate_synthetic_data.py --all

# Check frontend node modules
if [ ! -d "frontend/node_modules" ]; then
  echo "Frontend node_modules not found. Running npm install..."
  (cd frontend && npm install)
fi

# Array to keep track of spawned process PIDs
PIDS=()

# Clean shutdown function on Ctrl+C or script exit
cleanup() {
  echo ""
  echo "Shutting down all backend services and frontend server..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  echo "All services stopped. Exiting."
}

# Trap SIGINT (Ctrl+C) and EXIT signals
trap cleanup EXIT INT

# Ensure ports 3000, 8000, 8001, 8002, 8003 are free
echo "Checking for conflicting processes on ports 3000, 8000-8003..."
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -t -i :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Port $port is in use. Terminating process(es): $pids"
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
}
for port in 3000 8000 8001 8002 8003; do
  kill_port "$port"
done

echo "Starting microservices..."

# 1. Anomaly Scoring Service (Port 8001)
"$VENV_DIR/bin/uvicorn" services.anomaly_service.main:app --port 8001 > /dev/null 2>&1 &
PIDS+=($!)
echo " - Anomaly Service started on port 8001 (PID $!)"

# 2. Event Ingestion Service (Port 8002)
"$VENV_DIR/bin/uvicorn" services.ingestion_service.main:app --port 8002 > /dev/null 2>&1 &
PIDS+=($!)
echo " - Ingestion Service started on port 8002 (PID $!)"

# 3. CrewAI Workflow Service (Port 8003)
"$VENV_DIR/bin/uvicorn" agents.crew:app --port 8003 > /dev/null 2>&1 &
PIDS+=($!)
echo " - CrewAI Workflow Service started on port 8003 (PID $!)"

# 4. Incident Report API (Port 8000)
"$VENV_DIR/bin/uvicorn" services.incident_api.main:app --port 8000 > /dev/null 2>&1 &
PIDS+=($!)
echo " - Incident API Service started on port 8000 (PID $!)"

# 5. Next.js Frontend Server (Port 3000)
echo "Starting Next.js Frontend Dev Server..."
(cd frontend && npm run dev) &
PIDS+=($!)
echo " - Frontend Server started on port 3000 (PID $!)"

echo ""
echo "=== All services are running! ==="
echo "👉 Open your browser to http://localhost:3000"
echo "👉 Press Ctrl+C in this terminal to stop all services."
echo ""

# Keep script running to maintain background processes
while true; do
  sleep 1
done
