import { Link } from 'react-router-dom'
import { StatCard, IconHeart, IconHouse, IconBook, IconTrend } from '../components/StatCard'

export function PublicHome() {
  return (
    <div>
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
          <Link className="btn btn-primary lh-btn-pill lh-btn-donate px-4 d-inline-flex align-items-center gap-2" to="/contact">
            <span aria-hidden="true">&#9829;</span> Donate now
          </Link>
          <Link className="btn lh-btn-ghost lh-btn-pill px-4 d-inline-flex align-items-center gap-2" to="/impact">
            View impact <span aria-hidden="true">&#8594;</span>
          </Link>
        </div>
      </section>

      <section id="our-impact" className="lh-impact mt-4">
        <h2 className="lh-section-title h3 text-center mb-2">Our Impact</h2>
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
      </section>
    </div>
  )
}
