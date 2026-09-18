from collections.abc import Iterable

from app.schemas.telemetry import SensorReading, WaterBalance


BASELINE_WATER_IN = 1_000_000.0


def calculate_water_balance(readings: Iterable[SensorReading], water_in: float = BASELINE_WATER_IN) -> WaterBalance:
    readings = list(readings)
    process_consumption = sum(reading.consumption_lpd for reading in readings)
    recovered_water = sum(reading.recovered_water_lpd for reading in readings)
    discharge = sum(reading.discharge_lpd for reading in readings)
    unexplained_loss = max(0.0, water_in - process_consumption - recovered_water - discharge)

    return WaterBalance(
        water_in=round(water_in, 2),
        process_consumption=round(process_consumption, 2),
        recovered_water=round(recovered_water, 2),
        discharge=round(discharge, 2),
        unexplained_loss=round(unexplained_loss, 2),
        loss_percentage=round(unexplained_loss / water_in * 100, 2),
        recovery_percentage=round(recovered_water / water_in * 100, 2),
    )
