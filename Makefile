setup:
	pip install -r requirements.txt

gen-data:
	python scripts/generate_synthetic_data.py --all

run-anomaly:
	uvicorn services.anomaly_service.main:app --port 8001 --reload

run-ingest:
	uvicorn services.ingestion_service.main:app --port 8002 --reload

run-crew:
	uvicorn agents.crew:app --port 8003 --reload

run-api:
	uvicorn services.incident_api.main:app --port 8000 --reload

produce:
	python scripts/produce_events.py --scenario inverter_cooling_degradation --speed 20 --sink http://localhost:8002/ingest

produce-fast:
	python scripts/produce_events.py --scenario inverter_cooling_degradation --speed 999999 --sink http://localhost:8002/ingest

stream-live:
	python scripts/stream_live.py --speed 20 --phase1-real-mins 2

stream-live-fast:
	python scripts/stream_live.py --speed 60 --phase1-real-mins 1

run-all-scenarios:
	python scripts/run_all_scenarios.py --ingestion-url http://localhost:8002 --api-url http://localhost:8000 --timeout 180

run-scenario-b:
	python scripts/run_all_scenarios.py --scenario inverter_cooling_degradation --timeout 180

eval:
	python evaluation/run_eval.py --reports data/eval_reports/ --ground-truth data/ground_truth.json

run-all:
	make run-anomaly &
	make run-ingest &
	make run-crew &
	make run-api &
