export interface RecoverySummary {
  unexplained_loss_lpd: number
  potentially_recoverable_lpd: number
  recoverable_percentage: number
  freshwater_avoided_lpd: number
  recovery_factor: number
}

export interface ReuseOpportunity {
  destination: string
  suitability_score: number
  potential_volume_lpd: number
  treatment_required: boolean
  verification_required: boolean
  suitable: boolean
  reason: string
}

export interface ReuseSummary {
  opportunities: ReuseOpportunity[]
  recommended_destination: string | null
  recommendation_reason: string
}

export interface FinancialImpact {
  estimated_daily_value: number
  estimated_monthly_value: number
  potential_annual_value: number
  freshwater_avoided_lpd: number
  treatment_cost_per_litre: number
  pumping_cost_per_litre: number
  freshwater_cost_per_litre: number
}
