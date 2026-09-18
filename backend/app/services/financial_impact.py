from app.schemas.recovery import FinancialImpact, RecoverySummary, ReuseSummary

FRESHWATER_COST_PER_LITRE = 0.08
TREATMENT_COST_PER_LITRE = 0.02
PUMPING_COST_PER_LITRE = 0.005


def calculate_financial_impact(recovery: RecoverySummary, reuse: ReuseSummary) -> FinancialImpact:
    treatment_cost = TREATMENT_COST_PER_LITRE if any(item.suitable and item.treatment_required for item in reuse.opportunities) else 0.0
    net_value_per_litre = max(0.0, FRESHWATER_COST_PER_LITRE - treatment_cost - PUMPING_COST_PER_LITRE)
    daily_value = round(recovery.freshwater_avoided_lpd * net_value_per_litre, 2)
    return FinancialImpact(
        estimated_daily_value=daily_value,
        estimated_monthly_value=round(daily_value * 30, 2),
        potential_annual_value=round(daily_value * 365, 2),
        freshwater_avoided_lpd=recovery.freshwater_avoided_lpd,
        treatment_cost_per_litre=treatment_cost,
        pumping_cost_per_litre=PUMPING_COST_PER_LITRE,
        freshwater_cost_per_litre=FRESHWATER_COST_PER_LITRE,
    )
