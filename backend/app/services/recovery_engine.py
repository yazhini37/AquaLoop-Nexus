from app.schemas.recovery import RecoverySummary
from app.schemas.telemetry import WaterBalance

RECOVERY_FACTOR = 0.65


def calculate_recovery(balance: WaterBalance, recovery_factor: float = RECOVERY_FACTOR) -> RecoverySummary:
    factor = max(0.0, min(1.0, recovery_factor))
    recoverable = max(0.0, balance.unexplained_loss * factor)
    recoverable_percentage = recoverable / balance.water_in * 100 if balance.water_in else 0.0
    return RecoverySummary(
        unexplained_loss_lpd=round(balance.unexplained_loss, 2),
        potentially_recoverable_lpd=round(recoverable, 2),
        recoverable_percentage=round(recoverable_percentage, 2),
        freshwater_avoided_lpd=round(recoverable, 2),
        recovery_factor=factor,
    )
