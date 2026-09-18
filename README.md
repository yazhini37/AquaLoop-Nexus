# AquaLoop Nexus

## AI-powered industrial water intelligence and decision support

AquaLoop Nexus helps operators connect simulated telemetry to probable loss causes, recovery opportunities, reuse options, estimated impact, action priority, and repair-impact verification.

## Problem

Industrial water networks produce flow, pressure, consumption, and quality signals that can be difficult to interpret together. A useful operator workflow needs to connect abnormal readings with affected zones, explainable reasons, recoverable water, reuse suitability, and estimated operational value.

This project demonstrates that workflow with controlled, simulated industrial telemetry. It is a hackathon prototype, not a deployment in a real industrial plant.

## Solution

AquaLoop Nexus combines a Python telemetry simulator, FastAPI services, Isolation Forest anomaly detection, explainable engineering rules, water-balance calculations, recovery estimation, prototype reuse scoring, financial estimates, and a React dashboard.

The dashboard provides live simulated telemetry, zone-level investigation, a network topology, manual reading analysis, an Action Priority Center, what-if controls, charts, and before/after repair comparison.

## Core Workflow

```text
DETECT -> DIAGNOSE -> QUANTIFY -> RECOVER -> REUSE -> PRIORITIZE ACTION -> VERIFY IMPACT
```

## Key Features

- Industrial telemetry simulator with Normal, Leak, Suspicious Usage, Quality Anomaly, Repair, and Reset scenarios
- Water balance and unexplained-loss calculation
- Isolation Forest anomaly detection
- Hybrid AI and explainable engineering-rule loss fingerprinting
- Probable Leak classification
- Suspicious Usage classification
- Water-Quality Anomaly classification
- Sensor Anomaly classification
- Zone-level investigation with Detection Reasoning
- Severity and relative anomaly score
- Existing recommended actions from the analysis engine
- Water recovery estimation
- Reuse suitability analysis for Cooling, Equipment Washing, Utility, Process Use, and Boiler Feed
- Estimated financial impact
- Action Priority Center
- What-if simulation controls
- Before/after repair impact verification
- Live simulated telemetry charts
- Industrial Water Network visualization using React Flow
- Manual telemetry input and analysis through the existing analysis pipeline

## AI Approach

The anomaly detector uses scikit-learn Isolation Forest. It is trained on generated normal telemetry from the simulator. Relevant features include:

- Flow rate
- Pressure
- Consumption
- pH
- Turbidity
- Conductivity

Engineering-inspired rules then interpret model signals and deviations from zone baselines. The loss fingerprinting layer combines these signals to classify probable events, assign severity, produce Detection Reasoning, identify an affected zone, and recommend an action.

Anomaly scores are relative anomaly indicators, not calibrated probabilities. The prototype does not claim model accuracy percentages or guaranteed detection.

## Detection Reasoning

The dashboard presents readable reasoning derived from the existing backend analysis response. Depending on the current reading, evidence can describe flow, pressure, consumption, turbidity, conductivity, or pH deviations, along with the detected pattern and affected zone.

The supported classifications are:

- **Probable Leak**: does not mean a guaranteed leak.
- **Suspicious Usage Pattern**: does not mean confirmed theft.
- **Water-Quality Anomaly**: does not mean confirmed contamination.
- **Sensor Anomaly**: indicates a relative anomaly signal requiring investigation.

## Water Recovery

The backend calculates a water balance from current readings and freshwater input. Unexplained loss is estimated from the difference between water input, process consumption, recovered water, and discharge.

Recovery is a conservative prototype estimate based on the unexplained-loss value and a recovery factor. It is decision support, not a guarantee of recoverable water.

## Water Reuse Opportunities

The reuse optimizer evaluates the current quality profile and recoverable water against destination-specific prototype requirements for:

| Destination | Inputs considered |
| --- | --- |
| Cooling | pH, turbidity, conductivity, recoverable volume, anomaly state |
| Equipment Washing | pH, turbidity, conductivity, recoverable volume, anomaly state |
| Utility | pH, turbidity, conductivity, recoverable volume, anomaly state |
| Process Use | Stricter pH, turbidity, conductivity, volume, and anomaly requirements |
| Boiler Feed | Stricter pH, turbidity, conductivity, volume, and anomaly requirements |

Each destination receives a deterministic suitability score, suitability status, potential reuse volume, treatment/verification flags, and evidence describing the requirements. Potential volume is capped by current recoverable water and is zero when a destination is unsuitable.

Reuse suitability is prototype decision support, not certified safe reuse or automatic approval. Treatment and verification thresholds are prototype conditions, not universal industrial standards.

## Financial Impact

Financial impact is calculated from estimated freshwater avoided, treatment cost assumptions, pumping cost assumptions, and freshwater cost assumptions already present in the backend.

The dashboard reports estimated daily, monthly, and annual values. These are modelled estimates, not guaranteed savings.

## Action Priority Center

The Action Priority Center helps an operator understand which current event deserves attention first. It uses existing event severity, estimated water loss, estimated financial impact, affected zone, Detection Reasoning, and the existing recommended action.

Priority is deterministic:

- **HIGH**: active event with HIGH or CRITICAL severity
- **MEDIUM**: active event with a lower non-normal severity
- **LOW**: Normal or Repairing state

This is explainable decision support, not an AI prediction.

## What-If Simulation

The dashboard provides existing controls for:

- Normal through Reset
- Leak
- Suspicious Usage
- Quality Anomaly
- Repair
- Reset

These controls change the in-memory simulator scenario. The dashboard then refreshes analysis, water balance, recovery, reuse, financial impact, charts, network status, and repair comparison from the resulting simulated state.

## Manual Input Analysis

Manual Input accepts:

- Zone A, Zone B, Zone C, or Zone D
- Flow rate in L/min
- Pressure in bar
- pH
- TDS in ppm
- Optional timestamp

The reading is sent through the existing endpoint and analysis pipeline:

```text
POST /api/analyze-reading
```

Manual readings are labeled as Manual Reading and are not presented as historical live simulator telemetry. The live telemetry charts remain simulator-only.

## System Architecture

```text
Industrial Telemetry Simulator
	|
	v
FastAPI Backend
	|
	v
Analytics / AI / Recovery / Reuse / Financial Services
	|
	v
REST API
	|
	v
React Dashboard
```

## Technical Stack

### Frontend

- React
- TypeScript
- Vite
- Recharts
- React Flow
- Lucide React
- Tailwind CSS configuration
- Custom CSS

### Backend

- Python
- FastAPI
- Pydantic
- NumPy
- Uvicorn

Pandas is not currently imported by the backend or listed in `backend/requirements.txt`; it is not required by the current runtime.

### AI

- scikit-learn
- Isolation Forest
- Explainable engineering rules

### Data and storage

- Simulated industrial telemetry
- Simulator state and applicable prototype state are kept in memory
- No persistent database is required by the current implementation

SQLite or another persistent store could be considered for future telemetry and event history persistence, but it is not currently used.

## API Endpoints

### System and telemetry

| Method | Endpoint |
| --- | --- |
| GET | `/api/health` |
| GET | `/api/sensors?limit=100` |
| GET | `/api/dashboard` |
| GET | `/api/water-balance` |

### Analysis

| Method | Endpoint |
| --- | --- |
| GET | `/api/analysis` |
| GET | `/api/events?limit=50` |
| POST | `/api/analyze-reading` |

### Recovery and value

| Method | Endpoint |
| --- | --- |
| GET | `/api/recovery` |
| GET | `/api/reuse` |
| GET | `/api/financial-impact` |

### Simulator controls

| Method | Endpoint |
| --- | --- |
| POST | `/api/simulator/leak` |
| POST | `/api/simulator/unauthorized-usage` |
| POST | `/api/simulator/quality-anomaly` |
| POST | `/api/simulator/repair` |
| POST | `/api/simulator/reset` |

The dashboard derives its before/after repair comparison from existing recovery and financial-impact responses. There is no separate `/api/impact` endpoint.

## Demo Flow

1. Start in Normal using Reset.
2. Select **Simulate Leak**.
3. Observe Zone B become **Probable Leak**.
4. Review Detection Reasoning.
5. Review the Action Priority Center.
6. Review estimated water-loss impact.
7. Review the recovery estimate.
8. Review reuse opportunities.
9. Review estimated financial impact.
10. Trigger Repair.
11. Observe readings return toward Normal.
12. Review the before/after repair impact verification.

Suspicious Usage and Quality Anomaly scenarios are also supported by the existing controls.

## Prototype Scenario Validation

| Controlled scenario | Expected prototype result |
| --- | --- |
| Normal | Normal |
| Simulated Leak | Probable Leak |
| Suspicious Usage | Suspicious Usage |
| Quality Anomaly | Water-Quality Anomaly |
| Repair | Returns toward Normal |
| Reset | Normal |

These are controlled prototype scenarios and are not claims of real-world model accuracy, guaranteed leak detection, or plant validation.

## Running Locally

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer

### Backend

From the repository root:

```powershell
py -m pip install -r backend\requirements.txt
py -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

Backend URL: `http://localhost:8000`

### Frontend

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

The Windows Python launcher `py` is used in the commands above. Where Python is on `PATH`, `python -m uvicorn app.main:app --app-dir backend --reload --port 8000` is equivalent.

## Project Structure

```text
JARVIS_HACK/
├── README.md
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── ai/
│       │   ├── anomaly_detector.py
│       │   ├── loss_fingerprint.py
│       │   └── reuse_optimizer.py
│       ├── routes/
│       │   ├── analysis.py
│       │   ├── health.py
│       │   ├── recovery.py
│       │   └── simulator.py
│       ├── schemas/
│       │   ├── analysis.py
│       │   ├── manual_analysis.py
│       │   ├── recovery.py
│       │   └── telemetry.py
│       ├── services/
│       │   ├── financial_impact.py
│       │   ├── recovery_engine.py
│       │   ├── simulator.py
│       │   └── water_balance.py
│       └── simulator/
└── frontend/
    ├── index.html
    ├── package.json
    └── src/
	├── App.tsx
	├── App.css
	├── index.css
	├── services/api.ts
	├── types/
	└── assets/
```

## Limitations

- The current prototype uses simulated industrial telemetry.
- A Probable Leak does not guarantee a leak.
- A Suspicious Usage Pattern does not confirm theft.
- A Water-Quality Anomaly does not confirm contamination.
- Anomaly scores are not calibrated probabilities.
- Reuse suitability is prototype decision support, not certified safe reuse or automatic approval.
- Treatment and verification thresholds are prototype conditions, not universal industrial standards.
- Financial impact is an estimated modelled value, not guaranteed savings.
- The simulator and applicable prototype state are kept in memory.
- The system is not validated against a real industrial plant.

Real deployment would require plant instrumentation, site-specific engineering validation, facility-specific calibration, water-quality requirements, treatment validation, operational approval, authentication, monitoring, and security hardening.

## Future Scope

- Persistent telemetry and event history storage, potentially using SQLite or another suitable datastore
- Facility-specific calibration and validation
- Plant instrumentation integration
- Site-specific water-quality and treatment workflows
- Operational approval and verification workflows
- Authentication, monitoring, observability, and security hardening
- Broader scenario and what-if analysis

## Project Status

AquaLoop Nexus is a working hackathon prototype. It provides an end-to-end decision-support demonstration using simulated telemetry, existing explainable analytics, recovery and reuse estimates, financial modelling, action prioritization, and repair-impact comparison. It is not a certified industrial control, safety, contamination, or leak-detection system.
