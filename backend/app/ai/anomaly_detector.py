from collections.abc import Iterable

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.schemas.telemetry import SensorReading
from app.services.simulator import ZONE_BASELINES

FEATURE_NAMES = (
    "flow_rate_lpm",
    "pressure_bar",
    "consumption_lpd",
    "ph",
    "turbidity_ntu",
    "conductivity_us_cm",
)


class AnomalyDetector:
    def __init__(self) -> None:
        self.model = make_pipeline(
            StandardScaler(),
            IsolationForest(n_estimators=80, contamination=0.05, random_state=7),
        )
        self.model.fit(self._normal_training_data())

    def score(self, reading: SensorReading) -> float:
        features = np.array([self._features(reading)], dtype=float)
        decision = float(self.model.decision_function(features)[0])
        return round(float(np.clip(0.35 - decision, 0.0, 1.0)), 2)

    @staticmethod
    def _features(reading: SensorReading) -> list[float]:
        return [float(getattr(reading, feature)) for feature in FEATURE_NAMES]

    @staticmethod
    def _normal_training_data() -> np.ndarray:
        rows: list[list[float]] = []
        for baseline in ZONE_BASELINES.values():
            for step in range(40):
                drift = 1 + ((step % 9) - 4) * 0.006
                rows.append([
                    baseline["flow"] * drift,
                    baseline["pressure"] + ((step % 7) - 3) * 0.008,
                    baseline["consumption"] * (1 + ((step % 11) - 5) * 0.004),
                    baseline["ph"] + ((step % 5) - 2) * 0.012,
                    baseline["turbidity"] + ((step % 6) - 3) * 0.025,
                    baseline["conductivity"] * (1 + ((step % 8) - 4) * 0.003),
                ])
        return np.asarray(rows, dtype=float)


detector = AnomalyDetector()
