from datetime import datetime, timezone
from random import Random
from time import monotonic

from app.schemas.telemetry import DashboardSummary, SensorReading
from app.services.water_balance import calculate_water_balance

NORMAL = "NORMAL"
LEAK = "LEAK"
SUSPICIOUS_USAGE = "SUSPICIOUS_USAGE"
QUALITY_ANOMALY = "QUALITY_ANOMALY"
REPAIRED = "REPAIRED"
SIMULATION_INTERVAL_SECONDS = 60

ZONE_BASELINES = {
    "Zone A": {"flow": 175.0, "pressure": 3.5, "ph": 7.1, "turbidity": 1.8, "conductivity": 420.0, "temperature": 24.0, "consumption": 195_000.0, "recovered": 28_000.0, "discharge": 17_000.0},
    "Zone B": {"flow": 235.0, "pressure": 3.2, "ph": 6.9, "turbidity": 2.4, "conductivity": 540.0, "temperature": 26.0, "consumption": 260_000.0, "recovered": 34_000.0, "discharge": 20_000.0},
    "Zone C": {"flow": 145.0, "pressure": 3.0, "ph": 7.2, "turbidity": 2.0, "conductivity": 470.0, "temperature": 23.0, "consumption": 205_000.0, "recovered": 31_000.0, "discharge": 16_000.0},
    "Zone D": {"flow": 95.0, "pressure": 2.8, "ph": 7.0, "turbidity": 1.5, "conductivity": 390.0, "temperature": 22.0, "consumption": 120_000.0, "recovered": 27_000.0, "discharge": 17_000.0},
}


class SensorSimulator:
    def __init__(self) -> None:
        self.random = Random(42)
        self.scenario = NORMAL
        self.repair_progress = 0.0
        self._previous_affected_zone: str | None = None
        self.history: list[SensorReading] = []
        self._last_generated_monotonic = 0.0
        self.generate_readings(force=True)

    @property
    def affected_zone(self) -> str | None:
        return {LEAK: "Zone B", SUSPICIOUS_USAGE: "Zone C", QUALITY_ANOMALY: "Zone A", REPAIRED: self._repair_zone}.get(self.scenario)

    @property
    def _repair_zone(self) -> str | None:
        return self._previous_affected_zone

    def activate(self, scenario: str) -> None:
        self.scenario = scenario
        self.repair_progress = 0.0
        self._previous_affected_zone = {LEAK: "Zone B", SUSPICIOUS_USAGE: "Zone C", QUALITY_ANOMALY: "Zone A"}.get(scenario)
        self.generate_readings(force=True)

    def repair(self) -> None:
        self._previous_affected_zone = self.affected_zone
        self.scenario = REPAIRED
        self.repair_progress = 0.0
        self.generate_readings(force=True)

    def reset(self) -> None:
        self.scenario = NORMAL
        self.repair_progress = 0.0
        self._previous_affected_zone = None
        self.history.clear()
        self.generate_readings(force=True)

    def generate_readings(self, force: bool = False) -> list[SensorReading]:
        now_monotonic = monotonic()
        if not force and now_monotonic - self._last_generated_monotonic < SIMULATION_INTERVAL_SECONDS:
            return self.current_readings()

        # Keep demo telemetry stable between intentional 60-second simulation ticks.
        timestamp = datetime.now(timezone.utc)
        readings = [self._reading(zone, baseline, timestamp) for zone, baseline in ZONE_BASELINES.items()]
        self.history.extend(readings)
        self.history = self.history[-240:]
        self._last_generated_monotonic = now_monotonic
        if self.scenario == REPAIRED:
            self.repair_progress = min(1.0, self.repair_progress + 0.2)
            if self.repair_progress >= 1.0:
                self.scenario = NORMAL
                self._previous_affected_zone = None
        return readings

    def recent_readings(self, limit: int = 100) -> list[SensorReading]:
        self.generate_readings()
        return self.history[-max(1, min(limit, 240)):]

    def current_readings(self) -> list[SensorReading]:
        return self.history[-len(ZONE_BASELINES):]

    def current_water_in(self) -> float:
        if self.scenario == LEAK:
            return 1_090_000.0
        if self.scenario == SUSPICIOUS_USAGE:
            return 1_140_000.0
        if self.scenario == REPAIRED:
            return 1_000_000.0 + 90_000.0 * (1.0 - self.repair_progress)
        return 1_000_000.0

    def dashboard(self) -> DashboardSummary:
        readings = self.current_readings()
        balance = calculate_water_balance(readings, self.current_water_in())
        return DashboardSummary(
            current_scenario=self.scenario,
            network_status="Alert" if self.scenario == LEAK else "Warning" if self.scenario in {SUSPICIOUS_USAGE, QUALITY_ANOMALY} else "Recovering" if self.scenario == REPAIRED else "Normal",
            freshwater_input=balance.water_in,
            process_consumption=balance.process_consumption,
            recovered_water=balance.recovered_water,
            unexplained_loss=balance.unexplained_loss,
            active_event_count=0 if self.scenario == NORMAL else 1,
            affected_zone=self.affected_zone,
            latest_timestamp=readings[-1].timestamp,
        )

    def _reading(self, zone: str, baseline: dict[str, float], timestamp: datetime) -> SensorReading:
        variation = lambda amount: self.random.uniform(-amount, amount)
        values = dict(baseline)
        if self.scenario == LEAK and zone == "Zone B":
            values.update(flow=baseline["flow"] * 1.35, pressure=baseline["pressure"] * 0.72, consumption=baseline["consumption"] * 0.98, recovered=baseline["recovered"] * 0.5)
        elif self.scenario == SUSPICIOUS_USAGE and zone == "Zone C":
            values.update(consumption=baseline["consumption"] * 1.55, flow=baseline["flow"] * 1.12)
        elif self.scenario == QUALITY_ANOMALY and zone == "Zone A":
            values.update(turbidity=baseline["turbidity"] * 5, conductivity=baseline["conductivity"] * 1.65, ph=baseline["ph"] - 1.0)
        elif self.scenario == REPAIRED and zone == self.affected_zone:
            factor = 1.0 - self.repair_progress
            values["flow"] = baseline["flow"] * (1 + 0.35 * factor if self._previous_affected_zone == "Zone B" else 1 + 0.12 * factor)
            values["pressure"] = baseline["pressure"] * (1 - 0.28 * factor if self._previous_affected_zone == "Zone B" else 1)
            if self._previous_affected_zone == "Zone C":
                values["consumption"] = baseline["consumption"] * (1 + 0.55 * factor)
            if self._previous_affected_zone == "Zone A":
                values.update(turbidity=baseline["turbidity"] * (1 + 4 * factor), conductivity=baseline["conductivity"] * (1 + 0.65 * factor), ph=baseline["ph"] - factor)

        return SensorReading(
            timestamp=timestamp,
            zone=zone,
            flow_rate_lpm=round(values["flow"] + variation(3), 2),
            pressure_bar=round(values["pressure"] + variation(0.04), 2),
            ph=round(values["ph"] + variation(0.05), 2),
            turbidity_ntu=round(max(0.1, values["turbidity"] + variation(0.25)), 2),
            conductivity_us_cm=round(values["conductivity"] + variation(8), 2),
            temperature_c=round(values["temperature"] + variation(0.4), 2),
            consumption_lpd=round(max(0, values["consumption"] + variation(2_500)), 2),
            recovered_water_lpd=round(max(0, values["recovered"] + variation(1_200)), 2),
            discharge_lpd=round(max(0, values["discharge"] + variation(900)), 2),
        )


simulator = SensorSimulator()
