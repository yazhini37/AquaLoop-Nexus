import type { AnalysisResponse } from './analysis'

export type DataSource = 'live' | 'manual'

export interface ManualReadingRequest {
  zone: string
  flow_rate_lpm: number
  pressure_bar: number
  ph: number
  tds_ppm: number
  timestamp?: string
}

export type ManualAnalysisResponse = AnalysisResponse
