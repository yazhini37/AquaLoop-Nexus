from datetime import datetime, timezone

from fastapi import APIRouter, Query

from app.ai.loss_fingerprint import fingerprint_engine
from app.schemas.manual_analysis import ManualReadingRequest
from app.schemas.analysis import AnalysisResponse, DetectedEvent
from app.services.simulator import ZONE_BASELINES, simulator
from app.schemas.telemetry import SensorReading
from app.ai.reuse_optimizer import reuse_optimizer
from app.services.recovery_engine import calculate_recovery
from app.services.water_balance import calculate_water_balance

router = APIRouter(tags=["analysis"])


@router.post("/analyze-reading", response_model=AnalysisResponse)
def analyze_manual_reading(payload: ManualReadingRequest) -> AnalysisResponse:
    baseline = ZONE_BASELINES[payload.zone]
    reading = SensorReading(
        timestamp=payload.timestamp or datetime.now(timezone.utc),
        zone=payload.zone,
        flow_rate_lpm=payload.flow_rate_lpm,
        pressure_bar=payload.pressure_bar,
        ph=payload.ph,
        turbidity_ntu=max(0.1, payload.tds_ppm / 200),
        conductivity_us_cm=payload.tds_ppm * 1.5,
        temperature_c=baseline["temperature"],
        consumption_lpd=baseline["consumption"],
        recovered_water_lpd=baseline["recovered"],
        discharge_lpd=baseline["discharge"],
    )
    result = fingerprint_engine.analyze([reading], record_event=False)
    balance = calculate_water_balance(simulator.current_readings(), simulator.current_water_in())
    recovery = calculate_recovery(balance)
    result.reuse = reuse_optimizer.evaluate([reading], recovery.potentially_recoverable_lpd, result.current_event.event_type == "WATER_QUALITY_ANOMALY")
    return result


@router.get("/analysis", response_model=AnalysisResponse)
def get_analysis() -> AnalysisResponse:
    return fingerprint_engine.analyze(simulator.current_readings(), simulator.scenario)


@router.get("/events", response_model=list[DetectedEvent])
def get_events(limit: int = Query(default=50, ge=1, le=100)) -> list[DetectedEvent]:
    fingerprint_engine.analyze(simulator.current_readings(), simulator.scenario)
    return fingerprint_engine.recent_events(limit)
