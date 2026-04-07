export function About() {
  return (
    <article className="vstack gap-3">
      <section className="card border-0 shadow-sm">
        <div className="card-body p-3 p-lg-4">
          <div className="row g-3 align-items-center">
            <div className="col-lg-7">
              <h1 className="lh-section-title h2 mb-3">About Light on a Hill Foundation</h1>
              <p className="text-secondary mb-3">
                We serve survivors through safe shelter, trauma-informed support, education programs, and long-term reintegration planning.
              </p>
              <p className="text-secondary mb-0">
                The INTEX case dataset models supporters, donations, residents, education and health snapshots, and operational partners.
              </p>
            </div>
            <div className="col-lg-5">
              <div className="lh-photo-placeholder lh-photo-lg">Mission photo placeholder</div>
            </div>
          </div>
        </div>
      </section>

      <section className="row g-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-2">Our Mission</h2>
              <p className="text-secondary mb-0">Restore dignity and stability through compassionate services and measurable outcomes.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-2">Our Vision</h2>
              <p className="text-secondary mb-0">A world where every survivor can heal safely and thrive with community support.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h2 className="h5 mb-2">Our Values</h2>
              <p className="text-secondary mb-0">Safety, respect, accountability, and survivor-centered decision making in every program.</p>
            </div>
          </div>
        </div>
      </section>
    </article>
  )
}
