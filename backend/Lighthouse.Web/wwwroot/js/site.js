(function () {
  const key = "lh-theme"
  const root = document.documentElement

  function apply(stored) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light"
    root.setAttribute("data-bs-theme", theme)
    return theme
  }

  let current = apply(localStorage.getItem(key))

  document.querySelectorAll(".lh-theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      current = current === "dark" ? "light" : "dark"
      localStorage.setItem(key, current)
      apply(current)
    })
  })

  const revealSelector = ".lh-hero, .lh-impact, .lh-chart-card, .lh-kpi-card, .lh-stat-card, .lh-photo-placeholder, .card.border-0.shadow-sm"
  let revealIndex = 0
  const revealDelayStepMs = 55
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const delay = Number(entry.target.dataset.revealDelay || 0)
          if (delay > 0) entry.target.style.transitionDelay = `${delay}ms`
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  )

  function wireReveal() {
    document.querySelectorAll(revealSelector).forEach(function (el) {
      if (!el.classList.contains("lh-reveal") && !el.classList.contains("is-visible")) {
        el.classList.add("lh-reveal")
        el.dataset.revealDelay = String(Math.min(revealIndex * revealDelayStepMs, 360))
        revealIndex += 1
        observer.observe(el)
      }
    })
  }

  wireReveal()

  let revealQueued = false
  const mutationObserver = new MutationObserver(function () {
    if (revealQueued) return
    revealQueued = true
    requestAnimationFrame(function () {
      wireReveal()
      revealQueued = false
    })
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true })
})()
