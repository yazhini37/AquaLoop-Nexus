from datetime import datetime

from pydantic import BaseModel


class SensorReading(BaseModel):
    timestamp: datetime
    zone: str
    flow_rate_lpm: float
    pressure_bar: float
    ph: float
    turbidity_ntu: float
    conductivity_us_cm: float
    temperature_c: float
    consumption_lpd: float
    recovered_water_lpd: float
    discharge_lpd: float


class WaterBalance(BaseModel):
    water_in: float
    process_consumption: float
    recovered_water: float
    discharge: float
    unexplained_loss: float
    loss_percentage: float
    recovery_percentage: float


class DashboardSummary(BaseModel):
    current_scenario: str
    network_status: str
    freshwater_input: float
    process_consumption: float
    recovered_water: float
    unexplained_loss: float
    active_event_count: int
    affected_zone: str | None
    latest_timestamp: datetime


class SimulationResponse(BaseModel):
    success: bool
    scenario: str
    affected_zone: str | None
    message: str
