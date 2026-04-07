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

  const revealSelector = "section, .card, .lh-stat-card, .lh-kpi-card, .lh-chart-card, .lh-photo-placeholder"
  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
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
        observer.observe(el)
      }
    })
  }

  wireReveal()

  const mutationObserver = new MutationObserver(function () {
    wireReveal()
  })
  mutationObserver.observe(document.body, { childList: true, subtree: true })
})()
