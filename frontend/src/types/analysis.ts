import type { Scenario } from './api'
import type { ReuseSummary } from './recovery'

export type AnalysisEventType = 'NORMAL' | 'PROBABLE_LEAK' | 'SUSPICIOUS_USAGE' | 'WATER_QUALITY_ANOMALY' | 'SENSOR_ANOMALY'
export type AnalysisStatus = 'NORMAL' | 'WARNING' | 'ALERT' | 'QUALITY'

export interface ZoneAnalysis {
  zone: string
  status: AnalysisStatus
  anomaly_score: number
  evidence: string[]
}

export interface CurrentEvent {
  event_type: AnalysisEventType
  affected_zone: string | null
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  anomaly_score: number
  severity_reason: string
  explanation: string[]
  recommended_action: string
}

export interface AnalysisResponse {
  current_event: CurrentEvent
  zone_analysis: ZoneAnalysis[]
  reuse?: ReuseSummary | null
}

export interface DetectedEvent extends Omit<CurrentEvent, 'severity_reason'> {
  timestamp: string
}

export type AnalysisScenario = Scenario
