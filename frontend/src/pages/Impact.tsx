import { useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

type RetentionPoint = { month: string; rate: number }
type MixPoint = { name: string; value: number; color: string }
type MilestonePoint = { period: string; headline: string; summary: string }
type ImpactResponse = {
  chips: string[]
  kpis: { livesImpacted: number; safehouses: number; activePrograms: number; successRate: number }
  retention: RetentionPoint[]
  supportMix: MixPoint[]
  milestones: MilestonePoint[]
}

export function Impact() {
  const [data, setData] = useState<ImpactResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<ImpactResponse>('/api/impact')
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  const currentRetention = useMemo(() => {
    if (!data?.retention?.length) return null
    return data.retention[data.retention.length - 1].rate
  }, [data])

  if (error) {
    return <div className="alert alert-warning">Unable to load impact data: {error}</div>
  }

  if (!data) {
    return <div className="text-secondary">Loading impact data...</div>
  }

  return (
    <div className="vstack gap-4">
      <section className="lh-impact lh-impact-page-hero">
        <p className="lh-impact-kicker text-center mb-2">Impact Dashboard</p>
        <h1 className="lh-impact-title text-center mb-2">From Crisis to Reintegration</h1>
        <p className="lh-section-sub text-center mb-3">
          Case-based outcomes showing how support moves children from crisis response to long-term reintegration.
        </p>
        <div className="d-flex flex-wrap justify-content-center gap-2 text-center">
          {data.chips.map((chip) => (
            <span key={chip} className="lh-impact-chip">{chip}</span>
          ))}
        </div>
      </section>

      <section className="lh-impact lh-impact-page-pillars">
        <div className="row g-3 g-lg-4">
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-peach mx-auto mb-3">
                <img src="/img/Safety.webp" alt="Safety support icon" className="lh-impact-icon" />
              </div>
              <h2 className="lh-impact-item-title h3">Safety Support</h2>
              <p className="lh-impact-item-copy mb-2">
                First-response protection, safe housing, and immediate case handling for children in crisis.
              </p>
              <p className="lh-impact-evidence">Evidence: {data.kpis.livesImpacted.toLocaleString()} lives impacted</p>
            </article>
          </div>
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-green mx-auto mb-3">
                <img src="/img/Healing.jpg" alt="Healing and education icon" className="lh-impact-icon" />
              </div>
              <h2 className="lh-impact-item-title h3">Healing and Education</h2>
              <p className="lh-impact-item-copy mb-2">
                Trauma-informed care, school reintegration, and guided learning pathways for recovery.
              </p>
              <p className="lh-impact-evidence">Evidence: {data.kpis.activePrograms.toLocaleString()} active programs</p>
            </article>
          </div>
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-lilac mx-auto mb-3">
                <img src="/img/Justice.webp" alt="Justice and advocacy icon" className="lh-impact-icon" />
              </div>
              <h2 className="lh-impact-item-title h3">Justice and Advocacy</h2>
              <p className="lh-impact-item-copy mb-2">
                Legal referrals and partner coordination so children can pursue justice with dignity.
              </p>
              <p className="lh-impact-evidence">Evidence: {data.kpis.safehouses.toLocaleString()} safehouses in network</p>
            </article>
          </div>
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-gold mx-auto mb-3">
                <img src="/img/Empower.webp" alt="Empowerment and growth icon" className="lh-impact-icon" />
              </div>
              <h2 className="lh-impact-item-title h3">Empowerment and Growth</h2>
              <p className="lh-impact-item-copy mb-2">
                Leadership-building, life skills, and reintegration support for sustained independence.
              </p>
              <p className="lh-impact-evidence">Evidence: {data.kpis.successRate}% success rate</p>
            </article>
          </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Outcome Journey</h2>
              <div className="lh-impact-journey">
                <div className="lh-impact-step">
                  <strong>Intake</strong>
                  <span>Emergency safety and assessment</span>
                </div>
                <div className="lh-impact-step">
                  <strong>Stabilize</strong>
                  <span>Health and psychosocial recovery</span>
                </div>
                <div className="lh-impact-step">
                  <strong>Develop</strong>
                  <span>Education and skills progression</span>
                </div>
                <div className="lh-impact-step">
                  <strong>Reintegrate</strong>
                  <span>Community transition with support</span>
                </div>
              </div>
              <p className="text-secondary mb-0 mt-3">
                This pathway mirrors the case schema trajectory across incident response, interventions, progress records, and follow-up.
              </p>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Retention Trend</h2>
              <p className="text-secondary small mb-3">Share of supporters giving again month-over-month.</p>
              <div className="lh-impact-mini-chart">
                {data.retention.map((d) => (
                  <div key={d.month} className="lh-impact-mini-col">
                    <div className="lh-impact-mini-bar-wrap">
                      <span className="lh-impact-mini-bar" style={{ height: `${Math.max(d.rate - 55, 8)}%` }}></span>
                    </div>
                    <small>{d.month}</small>
                  </div>
                ))}
              </div>
              <p className="text-secondary mb-0 mt-3 small">
                Current retention level: <strong className="text-dark">{currentRetention ?? 0}%</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">Where Support Goes</h2>
              <p className="text-secondary small mb-3">Program effort mix by impact pillar.</p>
              <div className="d-flex flex-column gap-2">
                {data.supportMix.map((m) => (
                  <div key={m.name} className="lh-impact-trend-block">
                    <div className="d-flex justify-content-between align-items-center">
                      <span>{m.name}</span>
                      <strong>{m.value}%</strong>
                    </div>
                    <div className="lh-impact-trend-bar">
                      <span style={{ width: `${m.value}%`, background: m.color }}></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Milestones Timeline</h2>
              <ul className="lh-impact-timeline">
                {data.milestones.map((m) => (
                  <li key={`${m.period}-${m.headline}`}>
                    <strong>{m.period}:</strong> {m.headline}
                    <div className="small text-secondary">{m.summary}</div>
                  </li>
                ))}
              </ul>
              <p className="text-secondary mb-0 small">
                Future data hook: the planned Jupyter API can populate forecast badges here (retention likelihood, risk segments, projected reintegration).
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="lh-impact lh-impact-method">
        <p className="text-center text-secondary mb-0 small max-width mx-auto" style={{ maxWidth: '42rem' }}>
          Method note: figures currently reflect case seed data and existing aggregates. As your Jupyter pipeline is productionized,
          this page can consume forecast metrics through a dedicated API response without redesigning the layout.
        </p>
      </section>
    </div>
  )
}
