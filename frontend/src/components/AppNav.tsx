import { Link, NavLink } from 'react-router-dom'

function navLinkClass(active: boolean) {
  return active ? 'nav-link active' : 'nav-link'
}

export function AppNav() {
  return (
    <header className="lh-nav sticky-top">
      <nav className="navbar navbar-expand-lg navbar-light lh-navbar-shell w-100">
        <div className="container-fluid px-0 d-flex align-items-stretch flex-wrap">
          <Link className="lh-brand-ribbon navbar-brand lh-brand d-flex align-items-center text-decoration-none m-0 py-0" to="/">
            <span className="lh-brand-logo-frame">
              <img src="/img/Logo.png" alt="Light on a Hill Foundation" className="lh-brand-logo" />
            </span>
            <span className="lh-brand-wordmark text-body">Light on a Hill Foundation</span>
          </Link>
          <div className="lh-navbar-trail d-flex flex-grow-1 flex-wrap align-items-center min-w-0 ps-2 pe-3">
            <button
              className="navbar-toggler ms-auto my-2"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#viteMainNav"
              aria-controls="viteMainNav"
              aria-expanded="false"
              aria-label="Toggle navigation"
            >
              <span className="navbar-toggler-icon" />
            </button>
            <div className="collapse navbar-collapse flex-grow-1" id="viteMainNav">
              <ul className="navbar-nav mx-lg-auto mb-2 mb-lg-0 align-items-lg-center">
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/" end>
                    Home
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/impact">
                    Impact
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/about">
                    About
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/contact">
                    Contact
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={({ isActive }) => navLinkClass(isActive)} to="/privacy">
                    Privacy
                  </NavLink>
                </li>
              </ul>
              <div className="d-flex flex-wrap align-items-center gap-2 ms-lg-2">
                <button type="button" className="btn btn-link lh-theme-toggle" title="Toggle theme" aria-label="Toggle dark mode">
                  &#9789;
                </button>
                <Link className="btn btn-primary lh-btn-pill lh-btn-donate d-inline-flex align-items-center gap-2" to="/contact">
                  <span aria-hidden="true">&#9829;</span> Donate
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
