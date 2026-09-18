from datetime import datetime, timezone

from app.ai.anomaly_detector import detector
from app.schemas.analysis import AnalysisResponse, CurrentEvent, DetectedEvent, ZoneAnalysis
from app.schemas.telemetry import SensorReading
from app.services.simulator import ZONE_BASELINES

NORMAL = "NORMAL"
PROBABLE_LEAK = "PROBABLE_LEAK"
SUSPICIOUS_USAGE = "SUSPICIOUS_USAGE"
WATER_QUALITY_ANOMALY = "WATER_QUALITY_ANOMALY"
SENSOR_ANOMALY = "SENSOR_ANOMALY"


class LossFingerprintEngine:
    def __init__(self) -> None:
        self.events: list[DetectedEvent] = []
        self._last_event_key: tuple[str, str | None] | None = None

    def analyze(self, readings: list[SensorReading], simulator_scenario: str = NORMAL, record_event: bool = True) -> AnalysisResponse:
        zone_results = [self._zone_evidence(reading) for reading in readings]
        zone_analysis = [result[0] for result in zone_results]
        if simulator_scenario == "REPAIRED":
            current = self._normal_event("Readings are normalizing after the repair simulation.", "Continue observing the affected zone until readings stabilize.")
        else:
            current = self._classify(zone_results)
        if current.event_type != NORMAL and record_event:
            self._record(current)
        elif record_event:
            self._last_event_key = None
        return AnalysisResponse(current_event=current, zone_analysis=zone_analysis)

    def recent_events(self, limit: int = 50) -> list[DetectedEvent]:
        return self.events[-max(1, min(limit, 100)):][::-1]

    def _zone_evidence(self, reading: SensorReading) -> tuple[ZoneAnalysis, dict[str, float | list[str]]]:
        baseline = ZONE_BASELINES[reading.zone]
        flow_pct = (reading.flow_rate_lpm / baseline["flow"] - 1) * 100
        pressure_pct = (reading.pressure_bar / baseline["pressure"] - 1) * 100
        consumption_pct = (reading.consumption_lpd / baseline["consumption"] - 1) * 100
        turbidity_pct = (reading.turbidity_ntu / baseline["turbidity"] - 1) * 100
        conductivity_pct = (reading.conductivity_us_cm / baseline["conductivity"] - 1) * 100
        ph_delta = reading.ph - baseline["ph"]
        model_score = detector.score(reading)
        leak_evidence = max(0.0, min(1.0, (flow_pct / 35 + abs(min(0.0, pressure_pct)) / 28) / 2))
        usage_evidence = max(0.0, min(1.0, consumption_pct / 55))
        quality_evidence = max(0.0, min(1.0, max(turbidity_pct / 400, conductivity_pct / 65, abs(ph_delta) / 1.0)))
        evidence = []
        if flow_pct > 8:
            evidence.append(f"Flow is {flow_pct:.0f}% above normal baseline")
        if pressure_pct < -8:
            evidence.append(f"Pressure is {abs(pressure_pct):.0f}% below normal baseline")
        if consumption_pct > 20:
            evidence.append(f"Consumption is {consumption_pct:.0f}% above normal baseline")
        if turbidity_pct > 50:
            evidence.append(f"Turbidity is {turbidity_pct:.0f}% above normal baseline")
        if conductivity_pct > 15:
            evidence.append(f"Conductivity is {conductivity_pct:.0f}% above normal baseline")
        if abs(ph_delta) > 0.3:
            evidence.append(f"pH deviates by {abs(ph_delta):.1f} from normal baseline")
        combined_score = round(max(model_score, leak_evidence, usage_evidence, quality_evidence), 2)
        status = "NORMAL" if combined_score < 0.35 else "WARNING"
        if quality_evidence >= 0.55:
            status = "QUALITY"
        elif leak_evidence >= 0.55:
            status = "ALERT"
        return ZoneAnalysis(zone=reading.zone, status=status, anomaly_score=combined_score, evidence=evidence), {
            "flow_pct": flow_pct,
            "pressure_pct": pressure_pct,
            "consumption_pct": consumption_pct,
            "quality_evidence": quality_evidence,
            "leak_evidence": leak_evidence,
            "usage_evidence": usage_evidence,
            "model_score": model_score,
            "evidence": evidence,
        }

    def _classify(self, results: list[tuple[ZoneAnalysis, dict[str, float | list[str]]]]) -> CurrentEvent:
        leak = max(results, key=lambda item: float(item[1]["leak_evidence"]))
        usage = max(results, key=lambda item: float(item[1]["usage_evidence"]))
        quality = max(results, key=lambda item: float(item[1]["quality_evidence"]))
        candidate: tuple[str, str, dict[str, float | list[str]], float] | None = None
        if float(leak[1]["leak_evidence"]) >= 0.55 and float(leak[1]["pressure_pct"]) <= -12:
            candidate = (PROBABLE_LEAK, leak[0].zone, leak[1], float(leak[1]["leak_evidence"]))
        elif float(quality[1]["quality_evidence"]) >= 0.55:
            candidate = (WATER_QUALITY_ANOMALY, quality[0].zone, quality[1], float(quality[1]["quality_evidence"]))
        elif float(usage[1]["usage_evidence"]) >= 0.55 and abs(float(usage[1]["pressure_pct"])) < 10:
            candidate = (SUSPICIOUS_USAGE, usage[0].zone, usage[1], float(usage[1]["usage_evidence"]))
        else:
            strongest = max(results, key=lambda item: float(item[1]["model_score"]))
            if float(strongest[1]["model_score"]) >= 0.65:
                candidate = (SENSOR_ANOMALY, strongest[0].zone, strongest[1], float(strongest[1]["model_score"]))
        if candidate is None:
            return self._normal_event("All monitored readings remain within their normal engineering ranges.", "Continue routine monitoring of the simulated network.")
        event_type, zone, data, evidence_score = candidate
        explanation = list(data["evidence"])
        if event_type == PROBABLE_LEAK:
            explanation.append("Unexplained water loss has increased")
            action = f"Inspect {zone} pipeline and verify pressure/flow instrumentation."
        elif event_type == SUSPICIOUS_USAGE:
            explanation.append("Pressure remains relatively stable while usage rises")
            action = f"Review {zone} operating schedule and validate consumption instrumentation."
        elif event_type == WATER_QUALITY_ANOMALY:
            action = f"Review {zone} quality instrumentation and follow plant water-quality procedures."
        else:
            action = f"Check {zone} sensor calibration and compare against neighboring readings."
        score = round(min(0.99, max(evidence_score, float(data["model_score"]))), 2)
        severity, reason = self._severity(score, event_type)
        return CurrentEvent(event_type=event_type, affected_zone=zone, severity=severity, anomaly_score=score, severity_reason=reason, explanation=explanation, recommended_action=action)

    def _normal_event(self, explanation: str, action: str) -> CurrentEvent:
        return CurrentEvent(event_type=NORMAL, affected_zone=None, severity="LOW", anomaly_score=0.0, severity_reason="No rule thresholds exceeded.", explanation=[explanation], recommended_action=action)

    @staticmethod
    def _severity(score: float, event_type: str) -> tuple[str, str]:
        if score >= 0.85:
            return "CRITICAL", "Multiple strong telemetry deviations detected."
        if score >= 0.65:
            return "HIGH", "A strong telemetry fingerprint exceeds the high-severity threshold."
        if score >= 0.45:
            return "MEDIUM", "Several telemetry deviations exceed the monitoring threshold."
        return "LOW", f"The {event_type.lower()} signal is weak but worth observing."

    def _record(self, event: CurrentEvent) -> None:
        key = (event.event_type, event.affected_zone)
        if key == self._last_event_key:
            return
        self.events.append(DetectedEvent(timestamp=datetime.now(timezone.utc), **event.model_dump(exclude={"severity_reason"})))
        self.events = self.events[-100:]
        self._last_event_key = key


fingerprint_engine = LossFingerprintEngine()
