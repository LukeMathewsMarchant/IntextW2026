import { StatCard, IconHeart, IconHouse, IconBook, IconTrend } from '../components/StatCard'

export function Impact() {
  return (
    <div className="vstack gap-3">
      <section className="lh-impact">
        <h1 className="lh-section-title h2 text-center mb-2">Our Impact</h1>
        <p className="lh-section-sub text-center">Real numbers, real lives changed.</p>
        <div className="row g-3">
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
      </section>

      <section className="row g-3">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Program Highlights</h2>
              <div className="lh-photo-placeholder mb-3">Impact gallery placeholder</div>
              <ul className="mb-0 text-secondary">
                <li>Expanded safehouse capacity in underserved regions.</li>
                <li>Increased school reintegration rates through targeted tutoring.</li>
                <li>Strengthened partner network for healthcare and legal support.</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Milestones Timeline</h2>
              <div className="lh-photo-placeholder mb-3">Timeline graphic placeholder</div>
              <p className="text-secondary mb-0">Add photos, campaign moments, and year-over-year metrics here to tell a stronger story.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
