import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchJson } from '../api/client'

/** API fields use *Php suffix; values are displayed as USD per product copy. */
function formatUsd(amount: number, options?: { maximumFractionDigits?: number }) {
  const max = options?.maximumFractionDigits ?? 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: max,
    minimumFractionDigits: max > 0 ? 1 : 0,
  }).format(amount)
}

type SocialMediaSummary = {
  totalPosts: number
  totalDonationReferrals: number
  totalEstimatedDonationValuePhp: number
  avgEngagementRate: number
}

type PlatformRankingRow = {
  platform: string
  posts: number
  donationReferrals: number
  estimatedDonationValuePhp: number
  avgEngagementRate: number
  shareOfDonationValue: number
}

type RecommendationRow = {
  platform: string
  priority: string
  reason: string
  recommendedAction: string
  suggestedPostHours: string[]
  estimatedMonthlyLiftPhp: number
}

type PostingWindowRow = {
  platform: string
  dayOfWeek: string
  postHour: number
  avgDonationValuePhp: number
  avgReferrals: number
}

type SocialMediaAnalyticsResponse = {
  generatedAtUtc: string
  currency: string
  summary: SocialMediaSummary
  platformRanking: PlatformRankingRow[]
  recommendations: RecommendationRow[]
  bestPostingWindows: PostingWindowRow[]
}

/** Tight left margin + YAxis width; large left margin was shifting the whole plot right. */
const chartMargins = { top: 12, right: 16, left: 4, bottom: 56 }

function formatUsdAxisTick(v: number) {
  const n = Number(v)
  const compact = new Intl.NumberFormat('en-US', {
    notation: n >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n)
  return `$${compact}`
}

export function SocialMedia() {
  const [data, setData] = useState<SocialMediaAnalyticsResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchJson<SocialMediaAnalyticsResponse>('/api/admin/analytics/social-media')
      .then(setData)
      .catch((e: Error) => setErr(e.message))
  }, [])

  const platformChart = useMemo(
    () =>
      (data?.platformRanking ?? []).slice(0, 8).map((r) => ({
        platform: r.platform,
        value: Math.round(r.estimatedDonationValuePhp),
      })),
    [data],
  )

  return (
    <div>
      <h1 className="h3 mb-2">Social Media Analytics</h1>
      <p className="text-secondary mb-2">
        Pipeline-backed insights showing which platforms are driving donations and where to focus posting effort.
      </p>
      <p className="small text-secondary mb-3">
        All monetary amounts below are shown in <strong>US dollars (USD)</strong> for consistency with donor-facing
        reporting.
      </p>
      {err ? <div className="alert alert-warning">{err}</div> : null}

      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Total posts</div>
              <div className="h4 mb-0">{data?.summary.totalPosts ?? '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Donation referrals</div>
              <div className="h4 mb-0">{data?.summary.totalDonationReferrals?.toLocaleString() ?? '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Estimated donation value (USD)</div>
              <div className="h4 mb-0 text-break">
                {data ? formatUsd(Math.round(data.summary.totalEstimatedDonationValuePhp)) : '—'}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-secondary">Average engagement rate</div>
              <div className="h4 mb-0">{data ? `${(data.summary.avgEngagementRate * 100).toFixed(2)}%` : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-7 min-w-0">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5">Platforms leading donation value</h2>
              <p className="small text-secondary mb-2">Bar chart (top platforms). Full breakdown is in the table below.</p>
              <div className="w-100 py-2" style={{ minWidth: 0 }}>
                <div className="w-100" style={{ height: 440 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={platformChart}
                      margin={chartMargins}
                      barCategoryGap="12%"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-25" vertical={false} />
                      <XAxis
                        dataKey="platform"
                        type="category"
                        scale="band"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-28}
                        textAnchor="end"
                        height={72}
                        padding={{ left: 4, right: 4 }}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        width={54}
                        tickMargin={6}
                        tickFormatter={(v) => formatUsdAxisTick(Number(v))}
                      />
                      <Tooltip
                        formatter={(v) => [formatUsd(Number(v ?? 0)), 'Estimated value']}
                        labelFormatter={(label) => `Platform: ${label}`}
                      />
                      <Bar dataKey="value" name="Estimated value (USD)" fill="var(--bs-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="table-responsive mt-3 mb-0">
                <table className="table table-sm mb-0 align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Platform</th>
                      <th scope="col" className="text-end">
                        Posts
                      </th>
                      <th scope="col" className="text-end">
                        Referrals
                      </th>
                      <th scope="col" className="text-end">
                        Est. donation value (USD)
                      </th>
                      <th scope="col" className="text-end">
                        Avg. engagement
                      </th>
                      <th scope="col" className="text-end">
                        Share of value
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.platformRanking ?? []).map((r) => (
                      <tr key={r.platform}>
                        <td>{r.platform}</td>
                        <td className="text-end">{r.posts.toLocaleString()}</td>
                        <td className="text-end">{r.donationReferrals.toLocaleString()}</td>
                        <td className="text-end text-nowrap">{formatUsd(Math.round(r.estimatedDonationValuePhp))}</td>
                        <td className="text-end">{(r.avgEngagementRate * 100).toFixed(2)}%</td>
                        <td className="text-end">{(r.shareOfDonationValue * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(data?.platformRanking?.length ?? 0) === 0 ? (
                <p className="small text-secondary mb-0 mt-2">No platform ranking data yet.</p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col-lg-5 min-w-0">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5">Where to post more</h2>
              <div className="vstack gap-2">
                {(data?.recommendations ?? []).slice(0, 4).map((r) => (
                  <div key={`${r.platform}-${r.priority}`} className="border rounded p-2">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <strong className="text-break">{r.platform}</strong>
                      <span className={`badge flex-shrink-0 ${r.priority === 'High' ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {r.priority}
                      </span>
                    </div>
                    <div className="small text-secondary mt-1">{r.reason}</div>
                    <div className="small mt-1">
                      <strong>Action:</strong> {r.recommendedAction}
                    </div>
                    <div className="small mt-1">
                      <strong>Best hours:</strong> {r.suggestedPostHours.join(', ') || '—'}
                    </div>
                    <div className="small mt-1">
                      <strong>Estimated monthly lift (USD):</strong> {formatUsd(Math.round(r.estimatedMonthlyLiftPhp))}
                    </div>
                  </div>
                ))}
                {(data?.recommendations?.length ?? 0) === 0 ? <p className="small text-secondary mb-0">No recommendations yet.</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h2 className="h5">Best posting windows by platform</h2>
          <p className="small text-secondary mb-2">Average donation value per window is shown in USD.</p>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th scope="col">Platform</th>
                  <th scope="col">Day</th>
                  <th scope="col">Hour</th>
                  <th scope="col" className="text-end">
                    Avg donation value (USD)
                  </th>
                  <th scope="col" className="text-end">
                    Avg referrals
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.bestPostingWindows ?? []).slice(0, 20).map((w, idx) => (
                  <tr key={`${w.platform}-${w.dayOfWeek}-${w.postHour}-${idx}`}>
                    <td>{w.platform}</td>
                    <td>{w.dayOfWeek}</td>
                    <td>{w.postHour}:00</td>
                    <td className="text-end text-nowrap">{formatUsd(Math.round(w.avgDonationValuePhp))}</td>
                    <td className="text-end">{w.avgReferrals.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data?.bestPostingWindows?.length ?? 0) === 0 ? <p className="small text-secondary mt-2 mb-0">No posting-window analytics yet.</p> : null}
          <p className="small text-secondary mt-3 mb-0">Generated: {data?.generatedAtUtc ? new Date(data.generatedAtUtc).toLocaleString() : '—'}</p>
        </div>
      </div>
    </div>
  )
}
