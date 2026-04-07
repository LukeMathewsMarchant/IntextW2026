import { Link } from 'react-router-dom'
import { StatCard, IconHeart, IconHouse, IconBook, IconTrend } from '../components/StatCard'

export function PublicHome() {
  return (
    <div className="vstack gap-3">
      <section className="lh-hero text-center">
        <p className="lh-overline">Nonprofit organization</p>
        <h1 className="lh-hero-title">
          Restoring Hope.
          <br />
          <span className="lh-accent">Rebuilding Lives.</span>
        </h1>
        <p className="lh-hero-lead">
          We provide safe shelter, education, and long-term support to survivors of abuse and trafficking — helping them reclaim their independence and build a brighter future.
        </p>
        <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
          <Link className="btn btn-primary lh-btn-pill lh-btn-donate px-4 d-inline-flex align-items-center gap-2" to="/donate">
            <span aria-hidden="true">&#9829;</span> Donate now
          </Link>
          <Link className="btn lh-btn-ghost lh-btn-pill px-4 d-inline-flex align-items-center gap-2" to="/impact">
            View impact <span aria-hidden="true">&#8594;</span>
          </Link>
        </div>
      </section>

      <section className="row g-3 align-items-center">
        <div className="col-lg-6">
          <div className="lh-photo-placeholder lh-photo-lg">
            <span>Hero photo placeholder (community outreach image)</span>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3 p-lg-4">
              <h2 className="h4 lh-section-title mb-3">Why Your Support Matters</h2>
              <p className="text-secondary mb-3">
                Every contribution helps provide emergency shelter, trauma-informed care, education pathways, and practical job-readiness support.
              </p>
              <ul className="list-group list-group-flush">
                <li className="list-group-item px-0 d-flex justify-content-between bg-transparent">
                  <span>Emergency response kits</span>
                  <strong>Immediate</strong>
                </li>
                <li className="list-group-item px-0 d-flex justify-content-between bg-transparent">
                  <span>Education and tutoring</span>
                  <strong>Monthly</strong>
                </li>
                <li className="list-group-item px-0 d-flex justify-content-between bg-transparent">
                  <span>Housing and reintegration</span>
                  <strong>Long-term</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="our-impact" className="lh-impact mt-2">
        <h2 className="lh-section-title h3 text-center mb-2">Our Impact</h2>
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
      </section>

      <section className="row g-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="lh-photo-placeholder mb-3">Program photo placeholder</div>
              <h3 className="h5 mb-2">Shelter & Safety</h3>
              <p className="text-secondary mb-0">Safe housing with immediate protection, counseling, and case management support.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="lh-photo-placeholder mb-3">Education photo placeholder</div>
              <h3 className="h5 mb-2">Education Access</h3>
              <p className="text-secondary mb-0">Tutoring, school placement support, and scholarships for long-term independence.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="lh-photo-placeholder mb-3">Community photo placeholder</div>
              <h3 className="h5 mb-2">Community Reintegration</h3>
              <p className="text-secondary mb-0">Skills training and mentorship that help survivors rebuild stable, empowered lives.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
