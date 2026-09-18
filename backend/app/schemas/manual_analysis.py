from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ManualReadingRequest(BaseModel):
    zone: Literal["Zone A", "Zone B", "Zone C", "Zone D"]
    flow_rate_lpm: float = Field(ge=0)
    pressure_bar: float = Field(ge=0)
    ph: float = Field(ge=0, le=14)
    tds_ppm: float = Field(ge=0)
    timestamp: datetime | None = None
