import type { DashboardSummary, SensorReading, SimulationResponse, WaterBalance } from '../types/api'
import type { AnalysisResponse, DetectedEvent } from '../types/analysis'
import type { FinancialImpact, RecoverySummary, ReuseSummary } from '../types/recovery'
import type { ManualReadingRequest } from '../types/manual'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) throw new Error(`Backend request failed (${response.status})`)
  return response.json() as Promise<T>
}

export const getDashboard = () => request<DashboardSummary>('/dashboard')
export const getSensors = (limit = 100) => request<SensorReading[]>(`/sensors?limit=${limit}`)
export const getWaterBalance = () => request<WaterBalance>('/water-balance')
export const getAnalysis = () => request<AnalysisResponse>('/analysis')
export const getEvents = (limit = 50) => request<DetectedEvent[]>(`/events?limit=${limit}`)
export const getRecovery = () => request<RecoverySummary>('/recovery')
export const getReuse = () => request<ReuseSummary>('/reuse')
export const getFinancialImpact = () => request<FinancialImpact>('/financial-impact')
export const analyzeReading = (reading: ManualReadingRequest) => request<AnalysisResponse>('/analyze-reading', { method: 'POST', body: JSON.stringify(reading) })
export const triggerLeak = () => request<SimulationResponse>('/simulator/leak', { method: 'POST' })
export const triggerUnauthorizedUsage = () => request<SimulationResponse>('/simulator/unauthorized-usage', { method: 'POST' })
export const triggerQualityAnomaly = () => request<SimulationResponse>('/simulator/quality-anomaly', { method: 'POST' })
export const repair = () => request<SimulationResponse>('/simulator/repair', { method: 'POST' })
export const resetSimulation = () => request<SimulationResponse>('/simulator/reset', { method: 'POST' })
