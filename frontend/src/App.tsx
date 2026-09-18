import { useEffect, useRef, useState } from 'react'
import { Activity, Droplets, Gauge, Layers3, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ReactFlow, { Background, Controls, Handle, Position, type Edge, type Node, type NodeProps } from 'reactflow'
import { analyzeReading, getAnalysis, getDashboard, getEvents, getFinancialImpact, getRecovery, getReuse, getSensors, getWaterBalance, repair, resetSimulation, triggerLeak, triggerQualityAnomaly, triggerUnauthorizedUsage } from './services/api'
import type { AnalysisResponse, DetectedEvent } from './types/analysis'
import type { DataSource } from './types/manual'
import type { DashboardSummary, Scenario, SensorReading, WaterBalance } from './types/api'
import type { FinancialImpact, RecoverySummary, ReuseSummary } from './types/recovery'
import './App.css'
import 'reactflow/dist/style.css'

const zones = [
  { id: 'Zone A', label: 'Cooling' },
  { id: 'Zone B', label: 'Processing' },
  { id: 'Zone C', label: 'Washing' },
  { id: 'Zone D', label: 'Utility' },
]

const scenarioLabels: Record<Scenario, string> = {
  NORMAL: 'Normal',
  LEAK: 'Probable Leak',
  SUSPICIOUS_USAGE: 'Suspicious Usage Pattern',
  QUALITY_ANOMALY: 'Water-Quality Anomaly',
  REPAIRED: 'Recovering / Normalizing',
}

const formatNumber = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
type ImpactSnapshot = { loss: number; dailyValue: number; recoverable: number; scenario: Scenario; timestamp: string }
type ActionEntry = { timestamp: string; label: string; detail: string }
type ChartPoint = { timestamp: string; zone: string; time: string; flow: number; pressure: number; consumption: number; index: number }
type NetworkZoneData = { zone: { id: string; label: string }; reading?: SensorReading; status: NetworkStatus; anomalyScore?: number; selected: boolean; onSelect: () => void }
type NetworkStatus = 'NORMAL' | 'PROBABLE_LEAK' | 'SUSPICIOUS_USAGE' | 'WATER_QUALITY_ANOMALY' | 'SENSOR_ANOMALY'

const networkNodeTypes = { zone: NetworkZoneNode }

function App() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [balance, setBalance] = useState<WaterBalance | null>(null)
  const [sensors, setSensors] = useState<SensorReading[]>([])
  const [chartHistory, setChartHistory] = useState<ChartPoint[]>([])
  const chartHistoryRef = useRef<ChartPoint[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [recovery, setRecovery] = useState<RecoverySummary | null>(null)
  const [reuse, setReuse] = useState<ReuseSummary | null>(null)
  const [manualReuse, setManualReuse] = useState<ReuseSummary | null>(null)
  const [financialImpact, setFinancialImpact] = useState<FinancialImpact | null>(null)
  const [events, setEvents] = useState<DetectedEvent[]>([])
  const [actionEntries, setActionEntries] = useState<ActionEntry[]>([])
  const [beforeRepair, setBeforeRepair] = useState<ImpactSnapshot | null>(null)
  const [afterRepair, setAfterRepair] = useState<ImpactSnapshot | null>(null)
  const beforeRepairRef = useRef<ImpactSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const [dataSource, setDataSource] = useState<DataSource>('live')
  const [manualAnalysis, setManualAnalysis] = useState<AnalysisResponse | null>(null)
  const dataSourceRef = useRef<DataSource>('live')
  const [manualForm, setManualForm] = useState({ zone: 'Zone B', flow: '', pressure: '', ph: '', tds: '', timestamp: '' })
  const [manualErrors, setManualErrors] = useState<string[]>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [manualAnalyzedAt, setManualAnalyzedAt] = useState<string | null>(null)
  const [selectedNetworkZone, setSelectedNetworkZone] = useState<string | null>(null)

  const updateChartHistory = (readings: SensorReading[]) => {
    const points = new Map(chartHistoryRef.current.map((point) => [`${point.timestamp}-${point.zone}`, point]))
    readings.forEach((reading) => {
      const key = `${reading.timestamp}-${reading.zone}`
      points.set(key, {
        timestamp: reading.timestamp,
        zone: reading.zone,
        time: `${formatTime(reading.timestamp)} / ${reading.zone.replace('Zone ', '')}`,
        flow: reading.flow_rate_lpm,
        pressure: reading.pressure_bar,
        consumption: Math.round(reading.consumption_lpd / 1000),
        index: 0,
      })
    })
    const nextHistory = [...points.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)).slice(-16).map((point, index) => ({ ...point, index }))
    const previousLast = chartHistoryRef.current.at(-1)
    const nextLast = nextHistory.at(-1)
    if (!previousLast || previousLast.timestamp !== nextLast?.timestamp || previousLast.zone !== nextLast?.zone || chartHistoryRef.current.length !== nextHistory.length) {
      chartHistoryRef.current = nextHistory
      setChartHistory(nextHistory)
    }
  }

  const refresh = async () => {
    try {
      const [nextDashboard, nextSensors, nextBalance, nextAnalysis, nextRecovery, nextReuse, nextFinancialImpact, nextEvents] = await Promise.all([getDashboard(), getSensors(), getWaterBalance(), getAnalysis(), getRecovery(), getReuse(), getFinancialImpact(), getEvents()])
      setDashboard(nextDashboard)
      setSensors(nextSensors)
      updateChartHistory(nextSensors)
      setBalance(nextBalance)
      if (dataSourceRef.current === 'live') setAnalysis(nextAnalysis)
      setRecovery(nextRecovery)
      setReuse(nextReuse)
      setFinancialImpact(nextFinancialImpact)
      setEvents(nextEvents)
      if (['LEAK', 'SUSPICIOUS_USAGE', 'QUALITY_ANOMALY'].includes(nextDashboard.current_scenario) && !beforeRepairRef.current) {
        const snapshot = { loss: nextRecovery.unexplained_loss_lpd, dailyValue: nextFinancialImpact.estimated_daily_value, recoverable: nextRecovery.potentially_recoverable_lpd, scenario: nextDashboard.current_scenario, timestamp: new Date().toISOString() } satisfies ImpactSnapshot
        beforeRepairRef.current = snapshot
        setBeforeRepair(snapshot)
      }
      setError('')
      return { nextDashboard, nextRecovery, nextFinancialImpact }
    } catch {
      setError('Backend unavailable. Start FastAPI on port 8000 to reconnect live telemetry.')
    } finally {
      setLoading(false)
      return null
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (dashboard?.current_scenario === 'REPAIRED' && beforeRepairRef.current && recovery && financialImpact && !afterRepair) {
      setAfterRepair({ loss: recovery.unexplained_loss_lpd, dailyValue: financialImpact.estimated_daily_value, recoverable: recovery.potentially_recoverable_lpd, scenario: dashboard.current_scenario, timestamp: new Date().toISOString() })
    }
  }, [dashboard?.current_scenario, recovery, financialImpact, afterRepair])

  const runAction = async (name: string, request: () => Promise<unknown>) => {
    if (name === 'repair' && !beforeRepairRef.current && recovery && financialImpact) {
      const snapshot = { loss: recovery.unexplained_loss_lpd, dailyValue: financialImpact.estimated_daily_value, recoverable: recovery.potentially_recoverable_lpd, scenario: dashboard?.current_scenario ?? 'NORMAL', timestamp: new Date().toISOString() } satisfies ImpactSnapshot
      beforeRepairRef.current = snapshot
      setBeforeRepair(snapshot)
    }
    setAction(name)
    setError('')
    try {
      await request()
      const next = await refresh()
      const timestamp = new Date().toISOString()
      if (name === 'leak' || name === 'usage' || name === 'quality') {
        if (next) {
          const snapshot = { loss: next.nextRecovery.unexplained_loss_lpd, dailyValue: next.nextFinancialImpact.estimated_daily_value, recoverable: next.nextRecovery.potentially_recoverable_lpd, scenario: next.nextDashboard.current_scenario, timestamp } satisfies ImpactSnapshot
          beforeRepairRef.current = snapshot
          setBeforeRepair(snapshot)
          setAfterRepair(null)
        }
      } else if (name === 'repair') {
        setActionEntries((current) => [...current, { timestamp, label: 'Repair initiated', detail: 'Telemetry is normalizing' }])
        if (next && beforeRepairRef.current) {
          setAfterRepair({ loss: next.nextRecovery.unexplained_loss_lpd, dailyValue: next.nextFinancialImpact.estimated_daily_value, recoverable: next.nextRecovery.potentially_recoverable_lpd, scenario: next.nextDashboard.current_scenario, timestamp })
        }
      } else if (name === 'reset') {
        setBeforeRepair(null)
        beforeRepairRef.current = null
        setAfterRepair(null)
        setActionEntries((current) => [...current, { timestamp, label: 'Normal', detail: 'Simulation reset' }])
      }
    } catch {
      setError('The simulator action could not be completed. Check that the backend is running.')
    } finally {
      setAction('')
    }
  }

  const changeDataSource = (nextSource: DataSource) => {
    dataSourceRef.current = nextSource
    setDataSource(nextSource)
    setManualErrors([])
    if (nextSource === 'live') {
      setManualAnalysis(null)
      setManualReuse(null)
      setManualAnalyzedAt(null)
      void refresh()
    }
  }

  const submitManualReading = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: string[] = []
    const flow = Number(manualForm.flow)
    const pressure = Number(manualForm.pressure)
    const ph = Number(manualForm.ph)
    const tds = Number(manualForm.tds)
    if (!manualForm.flow || !Number.isFinite(flow) || flow < 0) errors.push('Flow rate must be 0 or greater.')
    if (!manualForm.pressure || !Number.isFinite(pressure) || pressure < 0) errors.push('Pressure must be 0 or greater.')
    if (!manualForm.ph || !Number.isFinite(ph) || ph < 0 || ph > 14) errors.push('pH must be between 0 and 14.')
    if (!manualForm.tds || !Number.isFinite(tds) || tds < 0) errors.push('TDS must be 0 or greater.')
    if (errors.length) {
      setManualErrors(errors)
      return
    }
    setManualErrors([])
    setManualLoading(true)
    try {
      const result = await analyzeReading({ zone: manualForm.zone, flow_rate_lpm: flow, pressure_bar: pressure, ph, tds_ppm: tds, timestamp: manualForm.timestamp || undefined })
      setManualAnalysis(result)
      setManualReuse(result.reuse ?? null)
      setManualAnalyzedAt(new Date().toISOString())
      setError('')
    } catch {
      setManualErrors(['Manual reading could not be analyzed. Check that the backend is running.'])
    } finally {
      setManualLoading(false)
    }
  }

  const chartData = chartHistory
  const scenario = dashboard?.current_scenario ?? 'NORMAL'
  const displayedAnalysis = dataSource === 'manual' ? manualAnalysis : analysis
  const displayedReuse = dataSource === 'manual' ? manualReuse ?? reuse : reuse
  const currentEvent = displayedAnalysis?.current_event
  const displayedAffectedZone = currentEvent?.affected_zone ?? dashboard?.affected_zone
  const networkZones = zones.map((zone) => {
    const reading = sensors.find((item) => item.zone === zone.id)
    const zoneAnalysis = displayedAnalysis?.zone_analysis.find((item) => item.zone === zone.id)
    const status = getNetworkStatus(zone.id, scenario, displayedAnalysis)
    return { zone, reading, status, anomalyScore: zoneAnalysis?.anomaly_score ?? (status === 'NORMAL' ? undefined : currentEvent?.anomaly_score), selected: selectedNetworkZone === zone.id }
  })
  const networkNodes: Node<NetworkZoneData | { label: string; kind: string }>[] = [
    { id: 'freshwater', position: { x: 0, y: 165 }, data: { label: 'Freshwater Input', kind: 'source' }, type: 'default', className: 'network-flow-node network-source' },
    { id: 'pump', position: { x: 240, y: 165 }, data: { label: 'Main Pump', kind: 'pump' }, type: 'default', className: 'network-flow-node network-pump' },
    ...networkZones.map(({ zone, reading, status, anomalyScore, selected }, index) => ({ id: zone.id, position: { x: 485, y: index * 105 }, data: { zone, reading, status, anomalyScore, selected, onSelect: () => setSelectedNetworkZone(zone.id) }, type: 'zone', className: 'network-zone-flow-node' })),
    { id: 'process', position: { x: 790, y: 165 }, data: { label: 'Process / Recovery', kind: 'recovery' }, type: 'default', className: 'network-flow-node network-recovery' },
  ]
  const networkEdges: Edge[] = [
    { id: 'freshwater-pump', source: 'freshwater', target: 'pump', type: 'smoothstep' },
    ...networkZones.flatMap(({ zone, status }) => {
      const active = zone.id === displayedAffectedZone && status !== 'NORMAL'
      return [
        { id: `pump-${zone.id}`, source: 'pump', target: zone.id, type: 'smoothstep', className: active ? 'network-edge-alert' : '' },
        { id: `${zone.id}-process`, source: zone.id, target: 'process', type: 'smoothstep', className: active ? 'network-edge-alert' : '' },
      ]
    }),
  ]
  const selectedZoneData = networkZones.find((item) => item.zone.id === selectedNetworkZone)

  useEffect(() => {
    if (['LEAK', 'SUSPICIOUS_USAGE', 'QUALITY_ANOMALY'].includes(scenario) && recovery && financialImpact && !beforeRepairRef.current) {
      const snapshot = { loss: recovery.unexplained_loss_lpd, dailyValue: financialImpact.estimated_daily_value, recoverable: recovery.potentially_recoverable_lpd, scenario, timestamp: new Date().toISOString() } satisfies ImpactSnapshot
      beforeRepairRef.current = snapshot
      setBeforeRepair(snapshot)
    }
  }, [scenario, recovery, financialImpact])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Droplets size={20} /></div>
          <div><p className="eyebrow">Industrial water intelligence</p><h1>AquaLoop Nexus</h1></div>
        </div>
        <div className={`system-status status-${scenario.toLowerCase()}`}><span /> {dashboard ? scenarioLabels[scenario] : 'Connecting'}</div>
      </header>

      <section className="welcome-row">
        <div>
          <p className="eyebrow">Operations overview / live telemetry</p>
          <h2>Water network command center</h2>
          <p className="muted">Monitor flow, balance, and scenario behavior across the simulated facility network.</p>
        </div>
        <div className="telemetry-badge"><Activity size={16} /> {loading ? 'Connecting...' : `Updated ${dashboard ? formatTime(dashboard.latest_timestamp) : '—'}`}</div>
      </section>

      <nav className="workflow-ribbon" aria-label="AquaLoop Nexus workflow">
        {['Detect', 'Diagnose', 'Quantify', 'Recover', 'Reuse', 'Verify Impact'].map((step, index) => <span key={step} className={index === 0 ? 'workflow-active' : ''}><b>{String(index + 1).padStart(2, '0')}</b>{step}</span>)}
      </nav>

      {error && <div className="error-banner"><TriangleAlert size={17} /> {error}</div>}

      <section className="control-bar what-if-bar">
        <div><p className="eyebrow">What-if impact simulator</p><strong>{dataSource === 'manual' ? 'Manual Reading Analysis' : scenarioLabels[scenario]}</strong>{dataSource === 'live' && dashboard?.affected_zone && <span> / {dashboard.affected_zone}</span>}<small>{dataSource === 'manual' ? 'Enter a sensor reading manually and analyze it using the same AquaLoop Nexus detection pipeline.' : `Loss ${formatNumber(recovery?.unexplained_loss_lpd ?? 0)} L/day · Estimated ₹${formatNumber(financialImpact?.estimated_daily_value ?? 0)}/day · Recoverable ${formatNumber(recovery?.potentially_recoverable_lpd ?? 0)} L/day`}</small></div>
        <div className="control-actions">
          <label className="data-source-select">Data Source<select value={dataSource} onChange={(event) => changeDataSource(event.target.value as DataSource)}><option value="live">Live Simulator</option><option value="manual">Manual Input</option></select></label>
          <button disabled={Boolean(action)} onClick={() => void runAction('reset', resetSimulation)}><RefreshCw size={14} /> Reset</button>
          <button disabled={Boolean(action)} onClick={() => void runAction('leak', triggerLeak)}>Simulate Leak</button>
          <button disabled={Boolean(action)} onClick={() => void runAction('usage', triggerUnauthorizedUsage)}>Suspicious Usage</button>
          <button disabled={Boolean(action)} onClick={() => void runAction('quality', triggerQualityAnomaly)}>Quality Anomaly</button>
          <button disabled={Boolean(action)} onClick={() => void runAction('repair', repair)}>Repair</button>
        </div>
      </section>

      {dataSource === 'manual' && <form className="manual-panel workspace-panel" onSubmit={submitManualReading}>
        <div className="panel-heading"><div><p className="eyebrow">Data Source: Manual Input</p><h3>Manual Reading Analysis</h3></div><span className="balance-percent">Decision support only</span></div>
        <div className="manual-grid">
          <label>Zone<select value={manualForm.zone} onChange={(event) => setManualForm({ ...manualForm, zone: event.target.value })}><option>Zone A</option><option>Zone B</option><option>Zone C</option><option>Zone D</option></select></label>
          <ManualField label="Flow Rate (L/min)" value={manualForm.flow} onChange={(value) => setManualForm({ ...manualForm, flow: value })} />
          <ManualField label="Pressure (bar)" value={manualForm.pressure} onChange={(value) => setManualForm({ ...manualForm, pressure: value })} />
          <ManualField label="pH" value={manualForm.ph} onChange={(value) => setManualForm({ ...manualForm, ph: value })} />
          <ManualField label="TDS (ppm)" value={manualForm.tds} onChange={(value) => setManualForm({ ...manualForm, tds: value })} />
          <label>Timestamp (optional)<input type="datetime-local" value={manualForm.timestamp} onChange={(event) => setManualForm({ ...manualForm, timestamp: event.target.value })} /></label>
        </div>
        {manualErrors.length > 0 && <div className="manual-errors">{manualErrors.map((message) => <span key={message}>{message}</span>)}</div>}
        <button className="analyze-button" type="submit" disabled={manualLoading}>{manualLoading ? 'Analyzing...' : 'Analyze Reading'}</button>
        <p className="estimate-note">Manual analysis is based on an entered reading and does not represent a confirmed factory measurement.</p>
      </form>}

      {beforeRepair && afterRepair && <section className="comparison-panel workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Simulated impact</p><h3>Before / after repair</h3></div><span className="verified-badge"><ShieldCheck size={14} /> Simulated impact verified</span></div>
        <div className="comparison-grid"><ComparisonStat label="Before repair" loss={beforeRepair.loss} value={beforeRepair.dailyValue} /><ComparisonStat label="After repair" loss={afterRepair.loss} value={afterRepair.dailyValue} /><ComparisonStat label="Potential water saved" loss={Math.max(0, beforeRepair.loss - afterRepair.loss)} value={Math.max(0, beforeRepair.dailyValue - afterRepair.dailyValue)} highlight /></div>
        <p className="estimate-note">Repair impact verified against simulated telemetry. This is decision support, not real-world repair verification.</p>
      </section>}

      <section className="metric-grid" aria-label="Network summary">
        <MetricCard icon={<Droplets size={18} />} label="Freshwater input" value={balance?.water_in} unit="L/day" accent />
        <MetricCard icon={<Gauge size={18} />} label="Process consumption" value={balance?.process_consumption} unit="L/day" />
        <MetricCard icon={<ShieldCheck size={18} />} label="Recovered water" value={balance?.recovered_water} unit="L/day" />
        <MetricCard icon={<TriangleAlert size={18} />} label="Unexplained loss" value={balance?.unexplained_loss} unit="L/day" alert={Boolean(balance && balance.unexplained_loss > 40_000)} />
        <MetricCard icon={<Activity size={18} />} label="Active events" value={dashboard?.active_event_count} unit="event" />
      </section>

      <section className="flow-panel workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Decision support path</p><h3>Loss to impact</h3></div><span className="balance-percent">Simulated Impact</span></div>
        <div className="impact-flow"><FlowStep label={currentEvent?.event_type === 'NORMAL' || !currentEvent ? 'No active loss' : eventLabel(currentEvent.event_type)} detail={currentEvent?.affected_zone ?? 'Network normal'} /><FlowStep label="Root cause" detail={currentEvent?.recommended_action ?? 'Routine monitoring'} /><FlowStep label="Action" detail={afterRepair ? 'Repair completed' : 'Use simulator controls'} /><FlowStep label="Impact" detail={afterRepair ? `${formatNumber(Math.max(0, (beforeRepair?.loss ?? 0) - afterRepair.loss))} L/day potential reduction` : 'Awaiting repair comparison'} /></div>
      </section>

      <section className={`priority-panel workspace-panel priority-${getPriority(currentEvent).toLowerCase()}`}>
        <div className="panel-heading"><div><p className="eyebrow">Operator decision support</p><h3>Action Priority Center</h3></div><span className="priority-badge">{getPriority(currentEvent)} PRIORITY</span></div>
        <div className="priority-summary"><div><span>Affected zone</span><strong>{currentEvent?.affected_zone ?? 'Network'}</strong></div><div><span>Classification</span><strong>{currentEvent ? eventLabel(currentEvent.event_type) : 'Normal'}</strong></div><div><span>Estimated water impact</span><strong>{formatNumber(recovery?.unexplained_loss_lpd ?? 0)} L/day</strong></div><div><span>Estimated financial impact</span><strong>₹{formatNumber(financialImpact?.estimated_daily_value ?? 0)}/day</strong></div></div>
        <div className="priority-details"><div><p className="eyebrow">Detection reasoning</p><ul>{decisionEvidence(currentEvent).map((item) => <li key={item}>{item}</li>)}</ul></div><div className="recommended-action"><p className="eyebrow">Existing recommended action</p><p>{currentEvent?.recommended_action ?? 'Continue routine monitoring of the simulated network.'}</p><small>Why this is prioritized: {priorityReason(currentEvent, recovery?.unexplained_loss_lpd ?? 0, financialImpact?.estimated_daily_value ?? 0)}</small></div></div>
      </section>

      <section className="timeline-panel workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Event history / scenario timeline</p><h3>Recent actions and events</h3></div><Activity size={20} /></div>
        <div className="timeline-list">{[...events.map((event) => ({ timestamp: event.timestamp, label: eventLabel(event.event_type), detail: `${event.affected_zone ?? 'Network'} · ${event.severity}` })), ...actionEntries].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).slice(-6).map((entry, index) => <div className="timeline-entry" key={`${entry.timestamp}-${entry.label}-${index}`}><time>{formatTime(entry.timestamp)}</time><span className="timeline-dot" /><div><strong>{entry.label}</strong><small>{entry.detail}</small></div></div>)}{events.length === 0 && actionEntries.length === 0 && <p className="muted">No actions recorded yet.</p>}</div>
      </section>

      <section className="workspace-panel network-panel">
        <div className="panel-heading"><div><p className="eyebrow">Network topology</p><h3>Industrial Water Network</h3></div><Layers3 size={20} /></div>
        <div className="network-flow-shell"><ReactFlow nodes={networkNodes} edges={networkEdges} nodeTypes={networkNodeTypes} fitView fitViewOptions={{ padding: 0.18 }} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} zoomOnScroll={false} panOnScroll={false} preventScrolling={false} minZoom={0.55} maxZoom={1.1}><Background color="#cfe3dc" gap={22} size={1} /><Controls showInteractive={false} /></ReactFlow></div>
        <div className="network-footer">
          <div className="network-legend" aria-label="Network status legend">{[['NORMAL', 'Normal'], ['PROBABLE_LEAK', 'Probable Leak'], ['SUSPICIOUS_USAGE', 'Suspicious Usage'], ['WATER_QUALITY_ANOMALY', 'Water Quality Anomaly'], ['SENSOR_ANOMALY', 'Sensor Anomaly']].map(([status, label]) => <span key={status}><i className={`legend-dot legend-${status.toLowerCase()}`} />{label}</span>)}</div>
          {selectedZoneData && <NetworkDetailCard zone={selectedZoneData.zone} reading={selectedZoneData.reading} status={selectedZoneData.status} anomalyScore={selectedZoneData.anomalyScore} onClose={() => setSelectedNetworkZone(null)} />}
        </div>
      </section>

      <section className={`investigation-panel workspace-panel ${currentEvent?.event_type !== 'NORMAL' ? 'investigation-alert' : ''}`}>
        <div className="panel-heading"><div><p className="eyebrow">{dataSource === 'manual' ? 'Manual Reading' : 'AI water intelligence'}</p><h3>{dataSource === 'manual' ? 'Manual Reading Analysis' : 'AI Water Intelligence'}</h3></div><span className="analysis-score">Anomaly Score: {Math.round((currentEvent?.anomaly_score ?? 0) * 100)}/100</span></div>
        {dataSource === 'manual' && manualAnalysis && currentEvent ? <div className="manual-result">
          <div className="manual-result-meta"><span>Zone: {currentEvent.affected_zone ?? manualForm.zone}</span><time>Analyzed {formatTime(manualAnalyzedAt ?? new Date().toISOString())}{manualForm.timestamp ? ` · Entered ${formatTime(new Date(manualForm.timestamp).toISOString())}` : ''}</time></div>
          <div className="manual-result-grid"><div><span>Classification</span><strong>{currentEvent.event_type}</strong></div><div><span>Severity</span><strong>{currentEvent.severity}</strong></div><div><span>Anomaly Score</span><strong>{currentEvent.anomaly_score.toFixed(2)}</strong></div></div>
          <div className="investigation-details"><div><p className="eyebrow">Evidence / reason</p><ul>{currentEvent.explanation.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="recommended-action"><p className="eyebrow">Recommended action</p><p>{currentEvent.recommended_action}</p><small>{currentEvent.severity_reason}</small></div></div>
        </div> : currentEvent?.event_type === 'NORMAL' || !currentEvent ? <div className="normal-analysis"><ShieldCheck size={22} /><div><strong>No significant anomaly detected</strong><p>All monitored readings remain within their normal engineering ranges.</p></div></div> : <div className="investigation-content">
          <div className="event-summary"><span className="event-symbol"><TriangleAlert size={21} /></span><div><p className="event-label">{eventLabel(currentEvent.event_type)}</p><strong>{currentEvent.affected_zone ?? 'Multiple zones'}</strong><span>Severity: {currentEvent.severity}</span></div></div>
          <div className="investigation-details"><div><p className="eyebrow">Why?</p><ul>{currentEvent.explanation.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="recommended-action"><p className="eyebrow">Recommended action</p><p>{currentEvent.recommended_action}</p><small>{currentEvent.severity_reason}</small></div></div>
        </div>}
      </section>

      <section className="chart-section">
        <p className="eyebrow">Live Simulator Telemetry</p>
        <div className="chart-grid">
          <ChartPanel title="Flow vs time" data={chartData} dataKey="flow" unit="L/min" color="#087f74" />
          <ChartPanel title="Pressure vs time" data={chartData} dataKey="pressure" unit="bar" color="#d18a32" />
          <ChartPanel title="Water consumption vs time" data={chartData} dataKey="consumption" unit="kL/day" color="#5274a6" />
        </div>
      </section>

      <section className="balance-panel workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Daily water balance</p><h3>Where the water goes</h3></div><span className="balance-percent">{balance?.loss_percentage ?? 0}% loss</span></div>
        <div className="balance-flow">{[
          ['Freshwater Input', balance?.water_in, 'input'], ['Process Consumption', balance?.process_consumption, 'consumption'], ['Recovered Water', balance?.recovered_water, 'recovered'], ['Discharge', balance?.discharge, 'discharge'], ['Unexplained Loss', balance?.unexplained_loss, 'loss'],
        ].map(([label, value, kind]) => <div className={`balance-item ${kind}`} key={label as string}><span>{label}</span><strong>{value == null ? '—' : `${formatNumber(value as number)} L`}</strong><div className="balance-bar"><i style={{ width: `${Math.min(100, (((value as number) || 0) / (balance?.water_in || 1)) * 100)}%` }} /></div></div>)}</div>
      </section>
      <section className="value-panel workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Water → value</p><h3>Water → Value</h3></div><span className="balance-percent">{recovery ? `${Math.round(recovery.recovery_factor * 100)}% recovery factor` : '—'}</span></div>
        <div className="value-grid">
          <ValueStat label="Potentially Recoverable" value={recovery?.potentially_recoverable_lpd} suffix="L/day" />
          <ValueStat label="Freshwater Avoided" value={recovery?.freshwater_avoided_lpd} suffix="L/day" />
          <ValueStat label="Estimated Daily Value" value={financialImpact?.estimated_daily_value} prefix="₹" />
          <ValueStat label="Estimated Monthly Value" value={financialImpact?.estimated_monthly_value} prefix="₹" />
          <ValueStat label="Potential Annual Value" value={financialImpact?.potential_annual_value} prefix="₹" />
        </div>
        <p className="estimate-note">Modelled estimate based on prototype cost assumptions. Financial values are estimates, not guaranteed savings.</p>
      </section>
      <section className="reuse-panel workspace-panel">
        <div className="panel-heading"><div><p className="eyebrow">Water reuse opportunities</p><h3>Water Reuse Opportunities</h3></div><span className="balance-percent">Prototype decision support</span></div>
        <div className="reuse-grid">{displayedReuse?.opportunities.map((opportunity) => <ReuseCard key={opportunity.destination} opportunity={opportunity} recommended={displayedReuse.recommended_destination === opportunity.destination} />)}</div>
        <p className="estimate-note">Treatment and verification requirements are prototype thresholds, not universal industrial standards or safety certification.</p>
      </section>
      <p className="disclaimer">AI-generated decision support. Results are based on simulated telemetry and should be verified with plant instrumentation and engineering procedures.</p>
    </main>
  )
}

function MetricCard({ icon, label, value, unit, accent = false, alert = false }: { icon: React.ReactNode; label: string; value?: number; unit: string; accent?: boolean; alert?: boolean }) {
  return <article className={`metric-card ${accent ? 'accent-card' : ''} ${alert ? 'alert-card' : ''}`}><div className="metric-icon">{icon}</div><p>{label}</p><strong>{value == null ? '—' : formatNumber(value)} <small>{unit}</small></strong><span>{value == null ? 'Waiting for telemetry' : 'Live from simulator'}</span></article>
}

function ComparisonStat({ label, loss, value, highlight = false }: { label: string; loss: number; value: number; highlight?: boolean }) {
  return <div className={`comparison-stat ${highlight ? 'comparison-highlight' : ''}`}><span>{label}</span><strong>{formatNumber(loss)} L/day</strong><small>{highlight ? 'Potential water saved' : 'Water loss'}</small><b>₹{formatNumber(value)}/day</b><small>{highlight ? 'Estimated value recovered' : 'Estimated impact'}</small></div>
}

function FlowStep({ label, detail }: { label: string; detail: string }) {
  return <div className="flow-step"><span>{label}</span><strong>{detail}</strong></div>
}

function ManualField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<input type="number" min="0" step="any" value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function ValueStat({ label, value, suffix, prefix = '' }: { label: string; value?: number; suffix?: string; prefix?: string }) {
  return <div className="value-stat"><span>{label}</span><strong>{value == null ? '—' : `${prefix}${formatNumber(value)}${suffix ? ` ${suffix}` : ''}`}</strong></div>
}

function ReuseCard({ opportunity, recommended }: { opportunity: ReuseSummary['opportunities'][number]; recommended: boolean }) {
  return <article className={`reuse-card ${recommended ? 'reuse-recommended' : ''} ${!opportunity.suitable ? 'reuse-unsuitable' : ''}`}><div className="reuse-card-heading"><h4>{opportunity.destination}</h4><b>{recommended ? 'Recommended' : opportunity.suitable ? 'Prototype suitable' : 'Not suitable'}</b></div><strong className="suitability-score">{Math.round(opportunity.suitability_score)}/100</strong><span className="reuse-volume">Potential: {formatNumber(opportunity.potential_volume_lpd)} L/day</span><div className="requirement-tags"><span>{opportunity.treatment_required ? 'Treatment Required' : 'No treatment indicated'}</span><span>{opportunity.verification_required ? 'Verification Required' : 'Verification not flagged'}</span></div><p>{opportunity.reason}</p></article>
}

function eventLabel(eventType: string) {
  return eventType === 'NORMAL' ? 'Normal' : eventType === 'PROBABLE_LEAK' ? 'Probable Leak' : eventType === 'SUSPICIOUS_USAGE' ? 'Suspicious Usage Pattern' : eventType === 'WATER_QUALITY_ANOMALY' ? 'Water-Quality Anomaly' : 'Sensor Anomaly'
}

function getPriority(event: AnalysisResponse['current_event'] | undefined) {
  if (!event || event.event_type === 'NORMAL') return 'LOW'
  return event.severity === 'HIGH' || event.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM'
}

function priorityReason(event: AnalysisResponse['current_event'] | undefined, waterImpact: number, financialImpact: number) {
  if (!event || event.event_type === 'NORMAL') return 'No active anomaly is currently reported by the analysis pipeline.'
  return `${event.severity.toLowerCase()}-severity anomaly with ${formatNumber(waterImpact)} L/day estimated water impact and ₹${formatNumber(financialImpact)}/day estimated financial impact.`
}

function decisionEvidence(event: AnalysisResponse['current_event'] | undefined) {
  if (!event || event.event_type === 'NORMAL') return ['No significant anomaly pattern detected in the current readings.']
  const evidence = event.explanation.map((item) => item
    .replace(/^Flow is .* above normal baseline$/i, 'Flow anomaly — above expected range')
    .replace(/^Pressure is .* below normal baseline$/i, 'Pressure anomaly — below expected range')
    .replace(/^Consumption is .* above normal baseline$/i, 'Consumption anomaly — above expected range')
    .replace(/^Turbidity is .* above normal baseline$/i, 'Turbidity anomaly — above expected range')
    .replace(/^Conductivity is .* above normal baseline$/i, 'Conductivity anomaly — above expected range')
    .replace(/^pH deviates .* from normal baseline$/i, 'pH anomaly — outside expected range'))
  return [...evidence, `Pattern match — ${eventLabel(event.event_type)}`, `Affected zone — ${event.affected_zone ?? 'Network'}`]
}

function NetworkZoneNode({ data }: NodeProps<NetworkZoneData>) {
  return <button className={`network-zone-node network-status-${data.status.toLowerCase()} ${data.selected ? 'network-zone-selected' : ''}`} onClick={data.onSelect} type="button"><Handle type="target" position={Position.Left} /><span className="network-zone-indicator" /><strong>{data.zone.id}</strong><small>{data.zone.label}</small><em>{networkStatusLabel(data.status)}</em><span className="network-reading">{data.reading ? `${data.reading.flow_rate_lpm.toFixed(0)} L/min · ${data.reading.pressure_bar.toFixed(1)} bar` : 'Awaiting telemetry'}</span><Handle type="source" position={Position.Right} /></button>
}

function NetworkDetailCard({ zone, reading, status, anomalyScore, onClose }: { zone: { id: string; label: string }; reading?: SensorReading; status: NetworkStatus; anomalyScore?: number; onClose: () => void }) {
  return <aside className="network-detail-card"><button className="network-detail-close" type="button" onClick={onClose} aria-label="Close zone details">×</button><p className="eyebrow">Zone detail</p><h4>{zone.id} / {zone.label}</h4><dl><dt>Flow</dt><dd>{reading ? `${reading.flow_rate_lpm.toFixed(1)} L/min` : '—'}</dd><dt>Pressure</dt><dd>{reading ? `${reading.pressure_bar.toFixed(2)} bar` : '—'}</dd><dt>pH</dt><dd>{reading?.ph.toFixed(2) ?? '—'}</dd><dt>TDS</dt><dd>{reading ? `${Math.round(reading.conductivity_us_cm / 1.5)} ppm` : '—'}</dd><dt>Current status</dt><dd>{networkStatusLabel(status)}</dd><dt>Anomaly score</dt><dd>{anomalyScore == null ? '—' : `${Math.round(anomalyScore * 100)}/100`}</dd></dl></aside>
}

function getNetworkStatus(zoneId: string, scenario: Scenario, analysis: AnalysisResponse | null): NetworkStatus {
  const event = analysis?.current_event
  if (event?.affected_zone === zoneId && event.event_type !== 'NORMAL') return event.event_type as NetworkStatus
  if (scenario === 'REPAIRED') return 'NORMAL'
  if (scenario === 'LEAK' && zoneId === 'Zone B') return 'PROBABLE_LEAK'
  if (scenario === 'SUSPICIOUS_USAGE' && zoneId === 'Zone C') return 'SUSPICIOUS_USAGE'
  if (scenario === 'QUALITY_ANOMALY' && zoneId === 'Zone A') return 'WATER_QUALITY_ANOMALY'
  const zoneStatus = analysis?.zone_analysis.find((item) => item.zone === zoneId)?.status
  if (zoneStatus === 'ALERT') return 'PROBABLE_LEAK'
  if (zoneStatus === 'QUALITY') return 'WATER_QUALITY_ANOMALY'
  if (zoneStatus === 'WARNING') return 'SENSOR_ANOMALY'
  return 'NORMAL'
}

function networkStatusLabel(status: NetworkStatus) {
  return status === 'PROBABLE_LEAK' ? 'Probable Leak' : status === 'SUSPICIOUS_USAGE' ? 'Suspicious Usage' : status === 'WATER_QUALITY_ANOMALY' ? 'Water Quality Anomaly' : status === 'SENSOR_ANOMALY' ? 'Sensor Anomaly' : 'Normal'
}

function ChartPanel({ title, data, dataKey, unit, color }: { title: string; data: ChartPoint[]; dataKey: 'flow' | 'pressure' | 'consumption'; unit: string; color: string }) {
  return <article className="chart-panel"><div className="chart-title"><h3>{title}</h3><span>{unit}</span></div><ResponsiveContainer width="100%" height={190}><LineChart data={data}><XAxis dataKey="index" tick={false} axisLine={false} /><YAxis width={40} tick={{ fontSize: 10, fill: '#78928d' }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.time ?? ''} formatter={(value) => [`${value ?? '—'} ${unit}`, title]} /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></article>
}

export default App
