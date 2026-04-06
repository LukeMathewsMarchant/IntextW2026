import { StatCard, IconHeart, IconHouse, IconBook, IconTrend } from '../components/StatCard'

export function Impact() {
  return (
    <div className="lh-impact">
      <h1 className="lh-section-title h2 text-center mb-2">Our Impact</h1>
      <p className="lh-section-sub text-center">Real numbers, real lives changed.</p>
      <div className="row g-4">
        <div className="col-sm-6 col-lg-3">
          <StatCard icon={<IconHeart />} value="2,500+" label="Lives Impacted" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard icon={<IconHouse />} value="12" label="Safe Houses" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard icon={<IconBook />} value="8" label="Active Programs" />
        </div>
        <div className="col-sm-6 col-lg-3">
          <StatCard icon={<IconTrend />} value="89%" label="Success Rate" />
        </div>
      </div>
      <p className="text-center text-secondary mt-4 mb-0 small max-width mx-auto" style={{ maxWidth: '36rem' }}>
        Figures reflect the INTEX case narrative and seed dataset; replace with live aggregates from your Supabase deployment when available.
      </p>
    </div>
  )
}
