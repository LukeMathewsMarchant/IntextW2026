import { useEffect, useMemo, useRef, useState } from 'react'
import type { TouchEvent, WheelEvent } from 'react'

export function About() {
  const board = [
    { name: 'Ryan Briggs', role: 'Co-Founder', photo: '/img/Ryan Briggs.jpg' },
    { name: 'Luke Marchant', role: 'Co-Founder', photo: '/img/Luke Marchant.jpg' },
    { name: 'Grant Pearce', role: 'Co-Founder', photo: '/img/Grant Pearce.jpg' },
    { name: 'Abbie Erickson', role: 'Co-Founder', photo: '/img/Abbie Erickson.jpg' },
    { name: 'Greg Anderson', role: 'Board Member', photo: '/img/Greg Anderson.jpg' },
    { name: 'Laura Cutler', role: 'Board Member', photo: '/img/Laura Cutler.jpg' },
    { name: 'Katy Reese', role: 'Board Member', photo: '/img/Katy Reese.jpg' },
    { name: 'Shelley Hunter', role: 'Board Member', photo: '/img/Shelley Hunter.jpg' },
    { name: 'Spencer Hilton', role: 'Board Member', photo: '/img/Spencer Hilton.jpg' },
    { name: 'Mark Keith', role: 'Board Member', photo: '/img/Mark Keith.jpg' },
  ]
  const testimonials = [
    {
      quote:
        "When I first arrived, I felt overwhelmed and unsure of what came next. The team gave me steady support, helped me build routines, and reminded me that healing can happen one day at a time.",
      outcome: "In school consistently for 16 months",
      person: "Program participant",
      tag: "Stabilization",
    },
    {
      quote:
        "I never felt pressured to share more than I was ready for. Counselors listened, explained each step, and helped me create goals that felt realistic for my future.",
      outcome: "Completed trauma care plan + skills track",
      person: "Youth resident",
      tag: "Counseling",
    },
    {
      quote:
        "What stayed with me most was the sense of safety and respect. Staff treated us with dignity and helped us reconnect with trusted adults so we could move forward with confidence.",
      outcome: "Family reintegration support in progress",
      person: "Former resident",
      tag: "Reintegration",
    },
    {
      quote:
        "I learned that I could ask for help without being judged. Staff celebrated small wins with me, and over time those small wins became real momentum in my life.",
      outcome: "Consistent counseling attendance for 1 year",
      person: "Program participant",
      tag: "Trauma Support",
    },
    {
      quote:
        "The education support gave me structure again. Tutors were patient and helped me rebuild confidence in class, which made me believe I could still reach my goals.",
      outcome: "Returned to grade-level coursework",
      person: "Youth resident",
      tag: "Education",
    },
    {
      quote:
        "I felt seen as a person, not a case file. The team helped me plan for safety, school, and family communication in a way that felt respectful and practical.",
      outcome: "Completed personal safety and transition plan",
      person: "Former resident",
      tag: "Case Planning",
    },
    {
      quote:
        "Healing was not rushed. I had space to process, learn healthy boundaries, and build trust with people who genuinely cared about my future.",
      outcome: "Advanced through resilience skills pathway",
      person: "Program participant",
      tag: "Resilience",
    },
  ]
  const metrics = [
    { name: "Donor retention rate", detail: "Tracks continuity of monthly and annual supporter giving." },
    { name: "Education continuity", detail: "Monitors attendance consistency and progression over time." },
    { name: "Reintegration progress", detail: "Measures readiness milestones and post-placement follow-up." },
    { name: "Incident response closure", detail: "Tracks safety incidents through documented follow-up and resolution." },
  ]
  const cardsPerSlide = 3
  const wheelLockRef = useRef(false)
  const touchStartXRef = useRef<number | null>(null)
  const paddedTestimonials = useMemo(() => {
    if (testimonials.length === 0) return testimonials
    const padded = [...testimonials]
    let fillIdx = 0
    while (padded.length % cardsPerSlide !== 0) {
      padded.push(testimonials[fillIdx % testimonials.length])
      fillIdx += 1
    }
    return padded
  }, [testimonials])
  const testimonialSlides = useMemo(() => {
    const slides: typeof testimonials[] = []
    for (let i = 0; i < paddedTestimonials.length; i += cardsPerSlide) {
      slides.push(paddedTestimonials.slice(i, i + cardsPerSlide))
    }
    return slides
  }, [paddedTestimonials])
  const loopedSlides = useMemo(() => {
    if (testimonialSlides.length <= 1) return testimonialSlides
    return [testimonialSlides[testimonialSlides.length - 1], ...testimonialSlides, testimonialSlides[0]]
  }, [testimonialSlides])
  const [activeSlide, setActiveSlide] = useState(testimonialSlides.length > 1 ? 1 : 0)
  const [isAnimating, setIsAnimating] = useState(true)

  useEffect(() => {
    setActiveSlide(testimonialSlides.length > 1 ? 1 : 0)
    setIsAnimating(true)
  }, [testimonialSlides.length])

  const goPrevTestimonials = () => {
    if (testimonialSlides.length <= 1) return
    setIsAnimating(true)
    setActiveSlide((current) => current - 1)
  }
  const goNextTestimonials = () => {
    if (testimonialSlides.length <= 1) return
    setIsAnimating(true)
    setActiveSlide((current) => current + 1)
  }
  const handleTrackpadWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (testimonialSlides.length <= 1) return
    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY)
    if (!horizontalIntent || Math.abs(event.deltaX) < 8) return
    event.preventDefault()
    if (wheelLockRef.current) return
    wheelLockRef.current = true
    if (event.deltaX > 0) goNextTestimonials()
    else goPrevTestimonials()
    window.setTimeout(() => {
      wheelLockRef.current = false
    }, 350)
  }
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }
  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (testimonialSlides.length <= 1 || touchStartXRef.current === null) return
    const endX = event.changedTouches[0]?.clientX ?? touchStartXRef.current
    const deltaX = touchStartXRef.current - endX
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0) goNextTestimonials()
      else goPrevTestimonials()
    }
    touchStartXRef.current = null
  }
  const handleTestimonialTransitionEnd = () => {
    if (testimonialSlides.length <= 1) return
    if (activeSlide === 0) {
      setIsAnimating(false)
      setActiveSlide(testimonialSlides.length)
      return
    }
    if (activeSlide === loopedSlides.length - 1) {
      setIsAnimating(false)
      setActiveSlide(1)
      return
    }
  }

  useEffect(() => {
    if (!isAnimating) {
      const id = window.requestAnimationFrame(() => {
        setIsAnimating(true)
      })
      return () => window.cancelAnimationFrame(id)
    }
    return undefined
  }, [isAnimating])

  return (
    <article className="vstack gap-3">
      <section className="card border-0 shadow-sm">
        <div className="card-body p-3 p-lg-4">
          <div className="row g-3 align-items-center">
            <div className="col-lg-7">
              <h1 className="lh-section-title h2 mb-3">About Light on a Hill Foundation</h1>
              <p className="text-secondary mb-3">
                We support child and youth survivors through safe shelter, trauma-informed care, education continuity, and practical pathways toward long-term
                stability.
              </p>
              <p className="text-secondary mb-0">
                Our model brings together real-world program operations, including supporter stewardship, funding activity, residential care, education and health
                progress, and coordinated partnerships so each child receives consistent, accountable support from crisis response to reintegration.
              </p>
            </div>
            <div className="col-lg-5">
              <div className="lh-photo-placeholder lh-photo-lg">
                <img className="lh-photo-img" src="/img/Love and Belonging.jpg" alt="Children forming a circle to represent love and belonging" />
              </div>
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

      <section className="lh-about-know-shell">
        <div className="p-3 p-lg-4">
          <div className="row g-4 align-items-start">
            <div className="col-lg-6">
              <div className="lh-about-know-photo">
                <img className="lh-photo-img" src="/img/Thailand Kids Peace.jpeg" alt="Children gathered in a peaceful group activity" />
              </div>
            </div>
            <div className="col-lg-6">
              <p className="lh-impact-kicker mb-2">Get to know Us</p>
              <div className="lh-about-know-highlight mb-3">
                <p className="mb-0">
                  Light on a Hill Foundation is a Thailand-focused child protection initiative that supports girls who have survived abuse or exploitation by
                  providing safe shelter, trauma-informed care, and coordinated rehabilitation services to support healthy reintegration.
                </p>
              </div>
              <p className="text-secondary mb-3">
                There is a significant need for residential shelters in vulnerable communities where children are at risk of abuse and trafficking. Our case
                model addresses that gap through structured residential care and close coordination with social welfare and protection partners.
              </p>
              <p className="text-secondary mb-3">
                Children are referred through trusted agencies and transitioned into a stable environment where social workers guide assessment, counseling,
                daily care, and individualized education planning. Medical and psychosocial services are integrated into each child’s case pathway.
              </p>
              <p className="text-secondary mb-0">
                Alongside direct care, legal and advocacy partners work toward child-safe justice outcomes. Because long-term healing is relational, we support
                reunification or alternative care planning with caregiver coaching so each child can move from crisis toward safety, stability, and hope.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-3 p-lg-4">
          <h2 className="lh-section-title h4 mb-3">How We Protect Children&apos;s Data</h2>
          <ul className="lh-about-list mb-0">
            <li>Public pages are designed to show aggregated, anonymized information rather than individual case records.</li>
            <li>Sensitive case workflows are available only in authenticated staff areas with role-based permissions.</li>
            <li>Administrative changes are logged to support accountability and review.</li>
            <li>Public reporting prioritizes survivor safety, privacy, and dignity in how outcomes are shared.</li>
          </ul>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-3 p-lg-4">
          <h2 className="lh-section-title h4 mb-3">How Donations Translate to Outcomes</h2>
          <div className="lh-flow-row">
            <div className="lh-flow-pill">Supporter contribution</div>
            <span className="lh-flow-arrow">&#8594;</span>
            <div className="lh-flow-pill">Program allocation</div>
            <span className="lh-flow-arrow">&#8594;</span>
            <div className="lh-flow-pill">Services delivered</div>
            <span className="lh-flow-arrow">&#8594;</span>
            <div className="lh-flow-pill">Resident outcomes</div>
          </div>
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-3 p-lg-4">
          <h2 className="lh-section-title h4 mb-3">What We Measure</h2>
          <div className="row g-3">
            {metrics.map((m) => (
              <div key={m.name} className="col-md-6">
                <article className="lh-measure-card h-100">
                  <h3 className="h6 mb-1">{m.name}</h3>
                  <p className="text-secondary mb-0 small">{m.detail}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lh-testimonials-shell">
        <div className="p-3 p-lg-4">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-4">
            <h2 className="lh-section-title h2 mb-0">Testimonials</h2>
          </div>
          <div className="lh-testimonial-viewport" onWheel={handleTrackpadWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <button type="button" className="lh-testimonial-arrow lh-testimonial-arrow-left" aria-label="Previous testimonials" onClick={goPrevTestimonials}>
              &#8592;
            </button>
            <button type="button" className="lh-testimonial-arrow lh-testimonial-arrow-right" aria-label="Next testimonials" onClick={goNextTestimonials}>
              &#8594;
            </button>
            <div
              className="lh-testimonial-track"
              style={{
                transform: `translateX(-${activeSlide * 100}%)`,
                transition: isAnimating ? 'transform 460ms ease' : 'none',
              }}
              onTransitionEnd={handleTestimonialTransitionEnd}
            >
              {loopedSlides.map((slide, slideIdx) => (
                <div key={slideIdx} className="lh-testimonial-slide">
                  <div className="lh-testimonial-grid">
                    {slide.map((t, idx) => (
                      <div key={`${slideIdx}-${t.person}-${idx}`} className="lh-testimonial-cell">
                        <article className="lh-testimonial-card h-100 w-100">
                          <p className="lh-testimonial-tag mb-2">{t.tag}</p>
                          <div className="lh-testimonial-quote">"</div>
                          <p className="lh-testimonial-copy mb-3">{t.quote}</p>
                          <p className="lh-testimonial-outcome mb-2">{t.outcome}</p>
                          <p className="lh-testimonial-meta mb-0">{t.person}</p>
                        </article>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="lh-safeguarding-note p-3 p-lg-4">
        <p className="mb-0">
          <strong>Safeguarding statement:</strong> Our public pages are designed to avoid identifying child-level information. Content is shared in aggregated
          form to support awareness while protecting safety, dignity, and long-term wellbeing.
        </p>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-body p-3 p-lg-4">
          <h2 className="lh-section-title h3 text-center mb-3">Light on a Hill Board</h2>
          <div className="row g-3 justify-content-center">
            {board.map((m) => (
              <div key={m.name} className="col-6 col-md-3 text-center">
                <div className="lh-board-avatar-wrap mx-auto mb-2">
                  <img className="lh-board-avatar" src={m.photo} alt={m.name} />
                </div>
                <h3 className="h6 mb-1">{m.name}</h3>
                <p className="small text-secondary mb-0">{m.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  )
}
