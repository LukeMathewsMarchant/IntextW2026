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

      <section id="our-impact" className="lh-home-whatwedo mt-2" aria-labelledby="what-we-do-heading">
        <header className="lh-home-whatwedo-header text-center mx-auto mb-4 mb-lg-5">
          <p className="lh-home-whatwedo-kicker mb-2">What we do</p>
          <h2 id="what-we-do-heading" className="lh-home-whatwedo-title mb-3">
            Safety, healing, justice, and empowerment
          </h2>
          <p className="lh-home-whatwedo-lead text-body-secondary mb-0">
            Four pillars guide how we walk alongside survivors—from immediate protection to long-term independence.
          </p>
        </header>
        <div className="row g-4">
          <div className="col-sm-6 col-xl-3">
            <article className="card border-0 shadow-sm h-100 lh-home-pillar-card overflow-hidden">
              <div className="lh-home-pillar-media lh-home-pillar-media--peach">
                <img src="/img/Safety.webp" alt="Illustration representing safety and shelter" className="lh-home-pillar-img" />
              </div>
              <div className="card-body p-4 text-center d-flex flex-column">
                <h3 className="h5 lh-home-pillar-title mb-2">Safety support</h3>
                <p className="text-body-secondary small flex-grow-1 mb-3 lh-home-pillar-copy">
                  Protection is the first step to healing—we prioritize safe shelter and immediate care.
                </p>
                <Link className="lh-home-pillar-link fw-semibold text-decoration-none" to="/impact">
                  How we keep kids safe <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          </div>
          <div className="col-sm-6 col-xl-3">
            <article className="card border-0 shadow-sm h-100 lh-home-pillar-card overflow-hidden">
              <div className="lh-home-pillar-media lh-home-pillar-media--green">
                <img src="/img/Healing.jpg" alt="Illustration representing healing and education" className="lh-home-pillar-img" />
              </div>
              <div className="card-body p-4 text-center d-flex flex-column">
                <h3 className="h5 lh-home-pillar-title mb-2">Healing &amp; education</h3>
                <p className="text-body-secondary small flex-grow-1 mb-3 lh-home-pillar-copy">
                  Trauma-informed support and learning pathways for emotional recovery and growth.
                </p>
                <Link className="lh-home-pillar-link fw-semibold text-decoration-none" to="/impact">
                  How we help children heal <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          </div>
          <div className="col-sm-6 col-xl-3">
            <article className="card border-0 shadow-sm h-100 lh-home-pillar-card overflow-hidden">
              <div className="lh-home-pillar-media lh-home-pillar-media--lilac">
                <img src="/img/Justice.webp" alt="Illustration representing justice and advocacy" className="lh-home-pillar-img" />
              </div>
              <div className="card-body p-4 text-center d-flex flex-column">
                <h3 className="h5 lh-home-pillar-title mb-2">Justice &amp; advocacy</h3>
                <p className="text-body-secondary small flex-grow-1 mb-3 lh-home-pillar-copy">
                  Dignified support through legal and social processes so every child’s voice matters.
                </p>
                <Link className="lh-home-pillar-link fw-semibold text-decoration-none" to="/impact">
                  How we pursue justice <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          </div>
          <div className="col-sm-6 col-xl-3">
            <article className="card border-0 shadow-sm h-100 lh-home-pillar-card overflow-hidden">
              <div className="lh-home-pillar-media lh-home-pillar-media--gold">
                <img src="/img/Empower.webp" alt="Illustration representing empowerment and growth" className="lh-home-pillar-img" />
              </div>
              <div className="card-body p-4 text-center d-flex flex-column">
                <h3 className="h5 lh-home-pillar-title mb-2">Empowerment &amp; growth</h3>
                <p className="text-body-secondary small flex-grow-1 mb-3 lh-home-pillar-copy">
                  Skills, confidence, and opportunity so survivors can lead their own futures.
                </p>
                <Link className="lh-home-pillar-link fw-semibold text-decoration-none" to="/impact">
                  How we empower children <span aria-hidden="true">→</span>
                </Link>
              </div>
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
