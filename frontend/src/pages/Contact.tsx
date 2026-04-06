import { useMemo } from 'react'

export function Contact() {
  const root = document.getElementById('root')
  const sent = useMemo(() => root?.dataset.contactSent === 'true', [root?.dataset.contactSent])

  return (
    <div className="row">
      <div className="col-lg-8">
        <h1 className="h3 mb-3">Contact</h1>
        {sent ? (
          <div className="alert alert-success">Thank you — your message was received.</div>
        ) : null}
        <form method="post" action="/contact" className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="mb-3">
              <label className="form-label" htmlFor="name">
                Name
              </label>
              <input className="form-control" id="name" name="name" required />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="email">
                Email
              </label>
              <input className="form-control" id="email" name="email" type="email" required />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="message">
                Message
              </label>
              <textarea className="form-control" id="message" name="message" rows={5} required />
            </div>
            <button className="btn btn-primary" type="submit">
              Send
            </button>
          </div>
        </form>
        <p className="text-secondary small mt-3 mb-0">
          For production, enable antiforgery validation on this endpoint and pass a token from the server or <code>/api/antiforgery/token</code>.
        </p>
      </div>
    </div>
  )
}
