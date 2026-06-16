setup:
	pip install -r requirements.txt

gen-data:
	python scripts/generate_synthetic_data.py --all

run-anomaly:
	uvicorn services.anomaly_service.main:app --port 8001

run-ingest:
	uvicorn services.ingestion_service.main:app --port 8002

run-crew:
	uvicorn agents.crew:app --port 8003

run-api:
	uvicorn services.incident_api.main:app --port 8000

produce:
	python scripts/produce_events.py --scenario inverter_cooling_degradation --speed 20 --sink http://localhost:8002/ingest

eval:
	python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json

run-all:
	make run-anomaly &
	make run-ingest &
	make run-crew &
	make run-api &
