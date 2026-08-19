# Offline NLP Integration Plan for QSAFE Nepal
> **Updated 2026-08-18**: Migrated from legacy Node.js/NLP.js to Python + FastAPI Microservice architecture.

## Objective
Seamlessly integrate the highly accurate, zero-connectivity Python `offline-nlp` intent classification engine into the Node.js QSafe backend.

## Architecture

The system utilizes a **Dual-Process Microservice Architecture**:
1. **Python NLP Engine (`offline-nlp/`)**: Runs as a local HTTP service via FastAPI on port 5000. It keeps the ML models (`model.joblib`, `vectorizer.joblib`) loaded in memory to achieve <5ms latency per query.
2. **Node.js Backend (`backend/`)**: The main server. Communicates with the Python NLP Engine via local HTTP calls for intent classification.

---

## Detailed Implementation Steps

### Step 1: Create the FastAPI Microservice
- Install `fastapi` and `uvicorn`.
- Create `offline-nlp/src/api.py`.
- Initialize `IntentEngine` on startup.
- Expose `POST /predict` endpoint returning intent dictionaries.
- Add `serve` command to `offline-nlp/src/main.py` CLI to boot the server.

### Step 2: Node.js NLP Client (`backend/src/services/nlpClient.js`)
- Create an internal HTTP client in the Node backend.
- Expose `getOfflineIntent(text)` which calls `http://127.0.0.1:5000/predict`.
- Implement robust error handling and strict timeouts (e.g., 500ms) to fallback gracefully if the Python server is offline.

### Step 3: Update `ragService.js` (Backend Controller)
- Remove legacy regex-based intent matching (`isEmergencyRelated`).
- Inject the `getOfflineIntent(text)` call.
- Map the resulting ML intent strings (e.g., `medical_emergency`, `sos_help_request`, `road_blockage_report`) to the appropriate `EMERGENCY_SAFETY_RESPONSES` output block (First Aid, Earthquake, Flood, etc.).
- Ensure `fallback_unclear` correctly triggers the varied off-topic messages.

### Step 4: Orchestration
- Document the startup process (e.g., running `python -m src.main serve` alongside `npm start`).
- Verify full end-to-end latency from the frontend UI to the backend, into the Python API, and back.

---

## Deliverables
- `offline-nlp/src/api.py` (FastAPI Wrapper)
- `backend/src/services/nlpClient.js` (Node connector)
- Updated `backend/src/services/ragService.js` (Controller Logic)
- Updated `requirements.txt` (fastapi, uvicorn)

## Success Criteria
- The backend successfully retrieves intents via local HTTP.
- Latency remains near-instant for the user.
- The system correctly falls back to safety guardrails if the API goes offline.
