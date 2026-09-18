from fastapi import APIRouter

from app.schemas.recovery import FinancialImpact, RecoverySummary, ReuseSummary
from app.services.financial_impact import calculate_financial_impact
from app.services.recovery_engine import calculate_recovery
from app.ai.reuse_optimizer import reuse_optimizer
from app.services.simulator import simulator
from app.services.water_balance import calculate_water_balance

router = APIRouter(tags=["recovery"])


def current_outputs() -> tuple[RecoverySummary, ReuseSummary, FinancialImpact]:
    readings = simulator.current_readings()
    balance = calculate_water_balance(readings, simulator.current_water_in())
    recovery = calculate_recovery(balance)
    reuse = reuse_optimizer.evaluate(readings, recovery.potentially_recoverable_lpd, simulator.scenario == "QUALITY_ANOMALY")
    financial = calculate_financial_impact(recovery, reuse)
    return recovery, reuse, financial


@router.get("/recovery", response_model=RecoverySummary)
def get_recovery() -> RecoverySummary:
    return current_outputs()[0]


@router.get("/reuse", response_model=ReuseSummary)
def get_reuse() -> ReuseSummary:
    return current_outputs()[1]


@router.get("/financial-impact", response_model=FinancialImpact)
def get_financial_impact() -> FinancialImpact:
    return current_outputs()[2]
