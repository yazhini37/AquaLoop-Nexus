from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.recovery import ReuseSummary


class ZoneAnalysis(BaseModel):
    zone: str
    status: str
    anomaly_score: float
    evidence: list[str] = Field(default_factory=list)


class CurrentEvent(BaseModel):
    event_type: str
    affected_zone: str | None
    severity: str
    anomaly_score: float
    severity_reason: str
    explanation: list[str]
    recommended_action: str


class AnalysisResponse(BaseModel):
    current_event: CurrentEvent
    zone_analysis: list[ZoneAnalysis]
    reuse: ReuseSummary | None = None


class DetectedEvent(BaseModel):
    timestamp: datetime
    event_type: str
    affected_zone: str | None
    severity: str
    anomaly_score: float
    explanation: list[str]
    recommended_action: str
