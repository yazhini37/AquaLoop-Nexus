export type Scenario = 'NORMAL' | 'LEAK' | 'SUSPICIOUS_USAGE' | 'QUALITY_ANOMALY' | 'REPAIRED'

export interface SensorReading {
  timestamp: string
  zone: string
  flow_rate_lpm: number
  pressure_bar: number
  ph: number
  turbidity_ntu: number
  conductivity_us_cm: number
  temperature_c: number
  consumption_lpd: number
  recovered_water_lpd: number
  discharge_lpd: number
}

export interface WaterBalance {
  water_in: number
  process_consumption: number
  recovered_water: number
  discharge: number
  unexplained_loss: number
  loss_percentage: number
  recovery_percentage: number
}

export interface DashboardSummary {
  current_scenario: Scenario
  network_status: string
  freshwater_input: number
  process_consumption: number
  recovered_water: number
  unexplained_loss: number
  active_event_count: number
  affected_zone: string | null
  latest_timestamp: string
}

export interface SimulationResponse {
  success: boolean
  scenario: Scenario
  affected_zone: string | null
  message: string
}
