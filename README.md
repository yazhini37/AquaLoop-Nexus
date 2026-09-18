# AquaLoop Nexus

AI-powered industrial water intelligence for detecting losses, diagnosing probable causes, identifying recovery and reuse opportunities, and quantifying estimated impact.

## Problem

Industrial facilities need a practical way to connect abnormal flow and quality readings with probable causes, affected zones, recoverable water, and estimated operational value. This hackathon project demonstrates that workflow with simulated telemetry.

## Solution

AquaLoop Nexus combines a Python telemetry simulator, FastAPI services, explainable anomaly analysis, water-balance calculations, conservative recovery estimates, prototype reuse suitability, and a live React dashboard.

## Key Features

- Water balance and unexplained-loss calculation
- Isolation Forest anomaly detection
- Hybrid loss fingerprinting and probable-event analysis
- Zone-level analysis with evidence and recommended actions
- Water recovery estimation
- Prototype reuse suitability for five destinations
- Estimated financial impact
- What-if loss and repair simulation
- Before/after repair impact verification
- Event history and live telemetry charts

## How It Works

```text
DETECT
	-> DIAGNOSE
	-> QUANTIFY
	-> RECOVER
	-> REUSE
	-> VERIFY IMPACT
```

The simulator generates stable, zone-specific industrial telemetry. The backend calculates water balance, scores anomalies, applies engineering rules, estimates recovery and reuse opportunities, and exposes the results through REST endpoints. The dashboard polls the services and presents the decision-support story.

## AI Approach

- Isolation Forest is trained once on generated normal telemetry using flow, pressure, consumption, pH, turbidity, and conductivity features.
- Explainable engineering rules interpret the model signal using baseline deviations.
- Loss fingerprints include probable leak, suspicious usage pattern, water-quality anomaly, and sensor anomaly.
- Anomaly scores are relative anomaly indicators, not calibrated probabilities.

## Technical Stack

- Frontend: React + TypeScript + Vite
- UI and charts: Tailwind CSS configuration, custom CSS, Recharts, React Flow, and Lucide React
- Backend: Python + FastAPI + Pydantic
- AI: scikit-learn Isolation Forest plus explainable engineering rules
- Data: Simulated industrial telemetry
- Database: SQLite-ready architecture; the current MVP keeps simulator state in memory

## Architecture

```text
Python Sensor Simulator
				-> FastAPI Backend
				-> Analytics / AI / Recovery Services
				-> REST API
				-> React Dashboard
```

## Demo Flow

1. Start from Reset / Normal.
2. Simulate a leak and observe Zone B become a Probable Leak.
3. Review the AI evidence, anomaly score, water loss, recovery, reuse, and estimated impact.
4. Select Repair and observe telemetry normalization.
5. Review the simulated before/after impact, potential water saved, and estimated value recovered.

The same controls support suspicious usage and water-quality anomaly scenarios.

## Running Locally

### Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer

### Frontend

From `JARVIS_HACK/frontend`:

```powershell
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

### Backend

From the repository root, install the backend requirements and run:

```powershell
py -m pip install -r backend\requirements.txt
py -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Backend URL: `http://localhost:8000`

The Windows Python launcher `py` is used above because it is available in the development environment. `python -m uvicorn app.main:app --app-dir backend --reload --port 8000` is equivalent where `python` is on `PATH`.

## API Endpoints

### System and telemetry

- `GET /api/health`
- `GET /api/sensors?limit=100`
- `GET /api/dashboard`
- `GET /api/water-balance`

### Analysis

- `GET /api/analysis`
- `GET /api/events?limit=50`

### Recovery and value

- `GET /api/recovery`
- `GET /api/reuse`
- `GET /api/financial-impact`

### Simulator controls

- `POST /api/simulator/leak`
- `POST /api/simulator/unauthorized-usage`
- `POST /api/simulator/quality-anomaly`
- `POST /api/simulator/repair`
- `POST /api/simulator/reset`

There is currently no `/api/impact` endpoint; the dashboard derives the before/after comparison from the existing recovery and financial-impact responses.

## Limitations

This hackathon prototype uses simulated industrial telemetry and provides decision-support estimates. Real deployment would require plant instrumentation, site-specific engineering validation, water-quality requirements, treatment validation, and operational approval.

- A probable leak is not guaranteed leak detection.
- A suspicious usage pattern is not confirmed theft.
- A water-quality anomaly is not confirmed contamination.
- Reuse suitability is prototype decision support, not certified safe reuse or automatic approval.
- Financial impact is estimated and does not represent guaranteed savings.
- Treatment and verification thresholds are prototypes, not universal industrial standards.

## Future Scope

- SQLite persistence for telemetry and event history
- More facility-specific calibration and validation
- Treatment and verification workflow integration
- Additional scenario and what-if analysis
- Production observability, authentication, and deployment hardening
