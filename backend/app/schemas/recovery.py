from pydantic import BaseModel, Field


class RecoverySummary(BaseModel):
    unexplained_loss_lpd: float
    potentially_recoverable_lpd: float
    recoverable_percentage: float
    freshwater_avoided_lpd: float
    recovery_factor: float


class ReuseOpportunity(BaseModel):
    destination: str
    suitability_score: float
    potential_volume_lpd: float
    treatment_required: bool
    verification_required: bool
    suitable: bool
    reason: str


class ReuseSummary(BaseModel):
    opportunities: list[ReuseOpportunity] = Field(default_factory=list)
    recommended_destination: str | None
    recommendation_reason: str


class FinancialImpact(BaseModel):
    estimated_daily_value: float
    estimated_monthly_value: float
    potential_annual_value: float
    freshwater_avoided_lpd: float
    treatment_cost_per_litre: float
    pumping_cost_per_litre: float
    freshwater_cost_per_litre: float
