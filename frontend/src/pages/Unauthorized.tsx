import { Link } from 'react-router-dom'

export function Unauthorized() {
  return (
    <section className="mx-auto" style={{ maxWidth: 720 }}>
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h1 className="h3 mb-2">Access denied</h1>
          <p className="text-secondary mb-3">Your account is signed in, but does not have permission to open this page.</p>
          <div className="d-flex gap-2 flex-wrap">
            <Link className="btn btn-primary lh-btn-pill" to="/">
              Go home
            </Link>
            <Link className="btn lh-btn-ghost lh-btn-pill" to="/login">
              Sign in with a different account
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
