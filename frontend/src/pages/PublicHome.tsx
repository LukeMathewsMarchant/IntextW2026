import { Link } from 'react-router-dom'

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

      <section className="row g-3 align-items-stretch">
        <div className="col-lg-6">
          <div className="lh-photo-placeholder lh-photo-lg lh-photo-hero-focus">
            <img className="lh-photo-img" src="/img/PinkPantsArmsUpByOcean-e1741391204308.jpg" alt="Community members celebrating by the ocean" />
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100 lh-home-support-card">
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

      <section id="our-impact" className="lh-impact lh-impact-whatwedo mt-2">
        <p className="lh-impact-kicker text-center mb-2">What we do</p>
        <h2 className="lh-impact-title text-center mb-4">Provide Safety. Healing. And Empowerment</h2>
        <div className="row g-3 g-lg-4">
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-peach mx-auto mb-3">
                <img src="/img/Safety.webp" alt="Safety support icon" className="lh-impact-icon" />
              </div>
              <h3 className="lh-impact-item-title">Safety</h3>
              <p className="lh-impact-item-copy mb-2">
                Safety is the first focus at Light on a Hill Foundation because protection is the first step to healing.
              </p>
              <Link className="lh-impact-item-link" to="/impact">Learn how we make kids safe</Link>
            </article>
          </div>
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-green mx-auto mb-3">
                <img src="/img/Healing.jpg" alt="Healing and education icon" className="lh-impact-icon" />
              </div>
              <h3 className="lh-impact-item-title">Healing</h3>
              <p className="lh-impact-item-copy mb-2">
                Once a child trusts that they are safe, we guide them through emotional recovery and long-term healing.
              </p>
              <Link className="lh-impact-item-link" to="/impact">Learn how we help children heal</Link>
            </article>
          </div>
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-lilac mx-auto mb-3">
                <img src="/img/Justice.webp" alt="Justice and advocacy icon" className="lh-impact-icon" />
              </div>
              <h3 className="lh-impact-item-title">Justice</h3>
              <p className="lh-impact-item-copy mb-2">
                We stand with children in legal and social support processes so justice is pursued with dignity and care.
              </p>
              <Link className="lh-impact-item-link" to="/impact">Learn how we seek justice</Link>
            </article>
          </div>
          <div className="col-sm-6 col-lg-3">
            <article className="lh-impact-item text-center h-100">
              <div className="lh-impact-icon-wrap lh-impact-icon-gold mx-auto mb-3">
                <img src="/img/Empower.webp" alt="Empowerment and growth icon" className="lh-impact-icon" />
              </div>
              <h3 className="lh-impact-item-title">Empowerment</h3>
              <p className="lh-impact-item-copy mb-2">
                Our goal is to help children move from victimhood to leadership through confidence, skills, and opportunity.
              </p>
              <Link className="lh-impact-item-link" to="/impact">Learn how we empower children</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="lh-photo-placeholder mb-3">
                <img className="lh-photo-img" src="/img/SunsetArmsUp.jpg" alt="Sunset outreach moment with arms raised" />
              </div>
              <h3 className="h5 mb-2">Shelter & Safety</h3>
              <p className="text-secondary mb-0">Safe housing with immediate protection, counseling, and case management support.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="lh-photo-placeholder mb-3">
                <img className="lh-photo-img" src="/img/Spiritual Needs.jpg" alt="Children in a circle activity session" />
              </div>
              <h3 className="h5 mb-2">Education Access</h3>
              <p className="text-secondary mb-0">Tutoring, school placement support, and scholarships for long-term independence.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="lh-photo-placeholder mb-3">
                <img className="lh-photo-img" src="/img/Hands_Circle.jpg" alt="Hands joined in a circle representing community support" />
              </div>
              <h3 className="h5 mb-2">Community Reintegration</h3>
              <p className="text-secondary mb-0">Skills training and mentorship that help survivors rebuild stable, empowered lives.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
