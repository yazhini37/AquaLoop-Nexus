from fastapi import APIRouter, Query

from app.schemas.telemetry import DashboardSummary, SensorReading, SimulationResponse, WaterBalance
from app.services.simulator import LEAK, QUALITY_ANOMALY, SUSPICIOUS_USAGE, simulator
from app.services.water_balance import calculate_water_balance

router = APIRouter(tags=["simulation"])


def activate(scenario: str, zone: str, message: str) -> SimulationResponse:
    simulator.activate(scenario)
    return SimulationResponse(success=True, scenario=scenario, affected_zone=zone, message=message)


@router.get("/sensors", response_model=list[SensorReading])
def get_sensors(limit: int = Query(default=100, ge=1, le=240)) -> list[SensorReading]:
    return simulator.recent_readings(limit)


@router.get("/water-balance", response_model=WaterBalance)
def get_water_balance() -> WaterBalance:
    return calculate_water_balance(simulator.current_readings(), simulator.current_water_in())


@router.get("/dashboard", response_model=DashboardSummary)
def get_dashboard() -> DashboardSummary:
    return simulator.dashboard()


@router.post("/simulator/leak", response_model=SimulationResponse)
def simulate_leak() -> SimulationResponse:
    return activate(LEAK, "Zone B", "Probable leak simulation activated")


@router.post("/simulator/unauthorized-usage", response_model=SimulationResponse)
def simulate_unauthorized_usage() -> SimulationResponse:
    return activate(SUSPICIOUS_USAGE, "Zone C", "Suspicious usage pattern simulation activated")


@router.post("/simulator/quality-anomaly", response_model=SimulationResponse)
def simulate_quality_anomaly() -> SimulationResponse:
    return activate(QUALITY_ANOMALY, "Zone A", "Water-quality anomaly simulation activated")


@router.post("/simulator/repair", response_model=SimulationResponse)
def simulate_repair() -> SimulationResponse:
    simulator.repair()
    return SimulationResponse(success=True, scenario="REPAIRED", affected_zone=simulator.affected_zone, message="Repair simulation activated; readings are normalizing")


@router.post("/simulator/reset", response_model=SimulationResponse)
def reset_simulation() -> SimulationResponse:
    simulator.reset()
    return SimulationResponse(success=True, scenario="NORMAL", affected_zone=None, message="Simulation reset to normal")
