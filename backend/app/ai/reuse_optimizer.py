from dataclasses import dataclass

from app.schemas.recovery import ReuseOpportunity, ReuseSummary
from app.schemas.telemetry import SensorReading


@dataclass(frozen=True)
class PrototypeRequirement:
    ph_min: float
    ph_max: float
    preferred_ph_min: float
    preferred_ph_max: float
    turbidity_max: float
    preferred_turbidity_max: float
    conductivity_max: float
    preferred_conductivity_max: float
    minimum_volume_lpd: float
    treatment_required: bool
    verification_required: bool
    allocation: float


PROTOTYPE_REQUIREMENTS = {
    "Cooling": PrototypeRequirement(6.5, 8.5, 6.8, 7.6, 5.0, 2.0, 800.0, 500.0, 2_000.0, True, True, 0.40),
    "Equipment Washing": PrototypeRequirement(6.0, 9.0, 6.7, 8.0, 10.0, 4.0, 1000.0, 700.0, 1_500.0, False, True, 0.25),
    "Utility": PrototypeRequirement(6.0, 9.0, 6.6, 8.2, 15.0, 5.0, 1200.0, 800.0, 1_000.0, False, False, 0.20),
    "Process Use": PrototypeRequirement(6.5, 8.0, 6.8, 7.5, 2.0, 1.0, 500.0, 350.0, 3_000.0, True, True, 0.10),
    "Boiler Feed": PrototypeRequirement(8.0, 9.2, 8.2, 8.8, 1.0, 0.5, 100.0, 80.0, 4_000.0, True, True, 0.05),
}


class ReuseOptimizer:
    def evaluate(self, readings: list[SensorReading], recoverable_lpd: float, quality_anomaly: bool = False) -> ReuseSummary:
        quality = self._quality_profile(readings)
        opportunities = [self._opportunity(destination, requirement, quality, recoverable_lpd, quality_anomaly) for destination, requirement in PROTOTYPE_REQUIREMENTS.items()]
        suitable = [item for item in opportunities if item.suitable]
        recommended = max(suitable, key=lambda item: item.suitability_score) if suitable else None
        if recommended:
            reason = f"{recommended.destination} has the highest prototype suitability score based on current pH, turbidity, and conductivity."
            destination = recommended.destination
        else:
            reason = "No suitable reuse destination identified"
            destination = None
        return ReuseSummary(opportunities=opportunities, recommended_destination=destination, recommendation_reason=reason)

    @staticmethod
    def _quality_profile(readings: list[SensorReading]) -> dict[str, float]:
        if not readings:
            return {"ph": 7.0, "turbidity": 0.0, "conductivity": 0.0}
        return {
            "ph": sum(reading.ph for reading in readings) / len(readings),
            "turbidity": max(reading.turbidity_ntu for reading in readings),
            "conductivity": max(reading.conductivity_us_cm for reading in readings),
        }

    @staticmethod
    def _opportunity(destination: str, requirement: PrototypeRequirement, quality: dict[str, float], recoverable_lpd: float, quality_anomaly: bool) -> ReuseOpportunity:
        strict_destination = destination in {"Process Use", "Boiler Feed"}
        ph_score = ReuseOptimizer._dynamic_range_score(quality["ph"], requirement.preferred_ph_min, requirement.preferred_ph_max, requirement.ph_min, requirement.ph_max) if strict_destination else ReuseOptimizer._range_score(quality["ph"], requirement.preferred_ph_min, requirement.preferred_ph_max, requirement.ph_min, requirement.ph_max)
        turbidity_score = ReuseOptimizer._dynamic_upper_limit_score(quality["turbidity"], requirement.preferred_turbidity_max, requirement.turbidity_max) if strict_destination else ReuseOptimizer._upper_limit_score(quality["turbidity"], requirement.preferred_turbidity_max, requirement.turbidity_max)
        conductivity_score = ReuseOptimizer._dynamic_upper_limit_score(quality["conductivity"], requirement.preferred_conductivity_max, requirement.conductivity_max) if strict_destination else ReuseOptimizer._upper_limit_score(quality["conductivity"], requirement.preferred_conductivity_max, requirement.conductivity_max)
        volume_score = min(100.0, max(0.0, recoverable_lpd) / requirement.minimum_volume_lpd * 100)
        quality_score = ph_score * 0.30 + turbidity_score * 0.25 + conductivity_score * 0.25 + volume_score * 0.20
        anomaly_penalty = 0.55 if quality_anomaly else 1.0
        score = round(quality_score * anomaly_penalty, 2)
        within_range = requirement.ph_min <= quality["ph"] <= requirement.ph_max and quality["turbidity"] <= requirement.turbidity_max and quality["conductivity"] <= requirement.conductivity_max
        suitable = within_range and recoverable_lpd >= requirement.minimum_volume_lpd and score >= 55 and not (quality_anomaly and destination in {"Process Use", "Boiler Feed"})
        volume = round(min(max(0.0, recoverable_lpd), max(0.0, recoverable_lpd) * requirement.allocation * score / 100), 2) if suitable else 0.0
        evidence = [
            ReuseOptimizer._range_evidence("pH", quality["ph"], requirement.preferred_ph_min, requirement.preferred_ph_max, requirement.ph_min, requirement.ph_max),
            ReuseOptimizer._limit_evidence("Turbidity", quality["turbidity"], requirement.preferred_turbidity_max, requirement.turbidity_max, "NTU"),
            ReuseOptimizer._limit_evidence("TDS/conductivity", quality["conductivity"], requirement.preferred_conductivity_max, requirement.conductivity_max, "uS/cm"),
            "Sufficient recoverable volume" if recoverable_lpd >= requirement.minimum_volume_lpd else f"Insufficient recoverable volume ({recoverable_lpd:.0f} L/day available; {requirement.minimum_volume_lpd:.0f} L/day required)",
        ]
        if quality_anomaly:
            evidence.append("Water-quality anomaly detected; prototype suitability reduced")
        reason = "; ".join(evidence) + "."
        if suitable and requirement.treatment_required:
            reason += " Treatment and verification required."
        elif suitable:
            reason += " Verification required before use."
        else:
            reason += " Not suitable under current prototype requirements."
        return ReuseOpportunity(destination=destination, suitability_score=score, potential_volume_lpd=volume, treatment_required=requirement.treatment_required, verification_required=requirement.verification_required, suitable=suitable, reason=reason)

    @staticmethod
    def _range_score(value: float, preferred_min: float, preferred_max: float, hard_min: float, hard_max: float) -> float:
        if preferred_min <= value <= preferred_max:
            return 100.0
        if value < preferred_min:
            return max(0.0, (value - hard_min) / (preferred_min - hard_min) * 100)
        return max(0.0, (hard_max - value) / (hard_max - preferred_max) * 100)

    @staticmethod
    def _dynamic_range_score(value: float, preferred_min: float, preferred_max: float, hard_min: float, hard_max: float) -> float:
        if value < hard_min:
            return max(0.0, hard_min / max(value, 0.01) * 10)
        return ReuseOptimizer._range_score(value, preferred_min, preferred_max, hard_min, hard_max)

    @staticmethod
    def _upper_limit_score(value: float, preferred_max: float, hard_max: float) -> float:
        if value <= preferred_max:
            return max(0.0, 100.0 - value / max(preferred_max, 0.01) * 10)
        return max(0.0, (hard_max - value) / (hard_max - preferred_max) * 90)

    @staticmethod
    def _dynamic_upper_limit_score(value: float, preferred_max: float, hard_max: float) -> float:
        if value <= hard_max:
            return ReuseOptimizer._upper_limit_score(value, preferred_max, hard_max)
        return round(hard_max / max(value, 0.01) * 100, 2)

    @staticmethod
    def _range_evidence(label: str, value: float, preferred_min: float, preferred_max: float, hard_min: float, hard_max: float) -> str:
        if preferred_min <= value <= preferred_max:
            return f"{label} within prototype range"
        if hard_min <= value <= hard_max:
            return f"{label} within allowable range but outside preferred range"
        return f"{label} outside prototype range"

    @staticmethod
    def _limit_evidence(label: str, value: float, preferred_max: float, hard_max: float, unit: str) -> str:
        if value <= preferred_max:
            return f"{label} within prototype range ({value:.0f} {unit})"
        if value <= hard_max:
            return f"{label} above preferred range ({value:.0f} {unit})"
        return f"{label} above threshold ({value:.0f} {unit})"


reuse_optimizer = ReuseOptimizer()
