import { useMemo, useState } from 'react'
import { fetchJson } from '../api/client'

const presetAmounts = [25, 50, 100, 250]

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function Donate() {
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(50)
  const [customAmount, setCustomAmount] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const effectiveAmount = useMemo(() => {
    if (selectedAmount === 'custom') {
      return Number.parseFloat(customAmount || '0')
    }
    return selectedAmount
  }, [customAmount, selectedAmount])

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setErrorMsg('Please fill in your first name, last name, and email.')
      setSubmitState('error')
      return
    }
    if (effectiveAmount <= 0) {
      setErrorMsg('Please select or enter a donation amount greater than $0.')
      setSubmitState('error')
      return
    }

    setSubmitState('submitting')
    setErrorMsg('')

    try {
      await fetchJson('/api/donate', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          amount: effectiveAmount,
          notes: notes.trim() || null,
        }),
      })
      setSubmitState('success')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setSubmitState('error')
    }
  }

  if (submitState === 'success') {
    return (
      <section className="mx-auto text-center" style={{ maxWidth: '760px' }}>
        <div className="card border-0 shadow-sm p-5">
          <div className="mb-3" style={{ fontSize: '3rem' }} aria-hidden="true">
            🎉
          </div>
          <h1 className="h2 mb-3">Thank You!</h1>
          <p className="text-secondary mb-4">
            Your generous donation of <strong>${effectiveAmount.toFixed(2)}</strong> has been recorded.
            Thank you for supporting Light on a Hill Foundation!
          </p>
          <button
            type="button"
            className="btn btn-primary lh-btn-pill px-4"
            onClick={() => {
              setSubmitState('idle')
              setFirstName('')
              setLastName('')
              setEmail('')
              setNotes('')
              setSelectedAmount(50)
              setCustomAmount('')
            }}
          >
            Make Another Donation
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto" style={{ maxWidth: '760px' }}>
      <h1 className="h2 mb-2">Donate</h1>
      <p className="text-secondary mb-4">
        Thank you for supporting Light on a Hill Foundation. Choose an amount and enter your details below.
      </p>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">Choose Amount</h2>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {presetAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`btn ${selectedAmount === amount ? 'btn-primary' : 'btn-outline-primary'}`}
                aria-pressed={selectedAmount === amount}
                onClick={() => setSelectedAmount(amount)}
              >
                ${amount}
              </button>
            ))}
            <button
              type="button"
              className={`btn ${selectedAmount === 'custom' ? 'btn-primary' : 'btn-outline-primary'}`}
              aria-pressed={selectedAmount === 'custom'}
              onClick={() => setSelectedAmount('custom')}
            >
              Custom
            </button>
          </div>

          {selectedAmount === 'custom' && (
            <div className="mb-4">
              <label htmlFor="customAmount" className="form-label">
                Custom amount
              </label>
              <div className="input-group">
                <span className="input-group-text">$</span>
                <input
                  id="customAmount"
                  className="form-control"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
            </div>
          )}

          <h2 className="h5 mb-3">Your Information</h2>
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="firstName" className="form-label">
                First name
              </label>
              <input
                id="firstName"
                className="form-control"
                type="text"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="lastName" className="form-label">
                Last name
              </label>
              <input
                id="lastName"
                className="form-control"
                type="text"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="col-12">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                className="form-control"
                type="email"
                placeholder="jane@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="col-12">
              <label htmlFor="notes" className="form-label">
                Notes <span className="text-secondary">(optional)</span>
              </label>
              <textarea
                id="notes"
                className="form-control"
                rows={3}
                placeholder="Leave a message with your donation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {submitState === 'error' && (
            <div className="alert alert-danger mt-3 mb-0">{errorMsg}</div>
          )}

          <div className="mt-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
            <strong className="fs-5">Total: ${Number.isFinite(effectiveAmount) ? effectiveAmount.toFixed(2) : '0.00'}</strong>
            <button
              type="button"
              className="btn btn-primary lh-btn-pill px-4"
              disabled={submitState === 'submitting'}
              onClick={handleSubmit}
            >
              {submitState === 'submitting' ? 'Processing...' : 'Donate Now'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
