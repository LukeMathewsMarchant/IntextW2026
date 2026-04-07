import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppNav } from './components/AppNav'
import { CookieBanner } from './components/CookieBanner'
import { RequireRole } from './components/RequireRole'
import { About } from './pages/About'
import { AdminAnalytics } from './pages/AdminAnalytics'
import { AdminAudit } from './pages/AdminAudit'
import { AdminCrud } from './pages/AdminCrud'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminDonorsContributions } from './pages/AdminDonorsContributions'
import { AdminCaseloadInventory } from './pages/AdminCaseloadInventory'
import { AdminProcessRecording } from './pages/AdminProcessRecording'
import { AdminHomeVisitationConferences } from './pages/AdminHomeVisitationConferences'
import { AdminOkr } from './pages/AdminOkr'
import { Contact } from './pages/Contact'
import { Donate } from './pages/Donate'
import { DonorDashboard } from './pages/DonorDashboard'
import { DonorHistory } from './pages/DonorHistory'
import { DonorInsights } from './pages/DonorInsights'
import { Privacy } from './pages/Privacy'
import { PublicHome } from './pages/PublicHome'
import { Impact } from './pages/Impact'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Unauthorized } from './pages/Unauthorized'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <AppNav />
      <CookieBanner />
      <main className="container py-4 lh-main flex-grow-1">
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/donate" element={<Donate />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/Donor" element={<RequireRole role="Donor"><DonorDashboard /></RequireRole>} />
          <Route path="/Donor/History" element={<RequireRole role="Donor"><DonorHistory /></RequireRole>} />
          <Route path="/Donor/Insights" element={<RequireRole role="Donor"><DonorInsights /></RequireRole>} />
          <Route path="/Admin" element={<RequireRole role="Admin"><AdminDashboard /></RequireRole>} />
          <Route path="/Admin/Crud/:entity" element={<RequireRole role="Admin"><AdminCrud /></RequireRole>} />
          <Route path="/Admin/Audit" element={<RequireRole role="Admin"><AdminAudit /></RequireRole>} />
          <Route path="/Admin/Okr" element={<RequireRole role="Admin"><AdminOkr /></RequireRole>} />
          <Route path="/Admin/Analytics" element={<RequireRole role="Admin"><AdminAnalytics /></RequireRole>} />
          <Route path="/Admin/DonorsContributions" element={<RequireRole role="Admin"><AdminDonorsContributions /></RequireRole>} />
          <Route path="/Admin/CaseloadInventory" element={<RequireRole role="Admin"><AdminCaseloadInventory /></RequireRole>} />
          <Route path="/Admin/ProcessRecording" element={<RequireRole role="Admin"><AdminProcessRecording /></RequireRole>} />
          <Route path="/Admin/HomeVisitationConferences" element={<RequireRole role="Admin"><AdminHomeVisitationConferences /></RequireRole>} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="lh-footer py-4 mt-auto small">
        <div className="container d-flex flex-wrap justify-content-between align-items-center gap-2 text-secondary">
          <span>&copy; {new Date().getUTCFullYear()} Light on a Hill Foundation</span>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <a className="lh-social-link" href="#" aria-label="Facebook (placeholder)">
              Facebook
            </a>
            <a className="lh-social-link" href="#" aria-label="Instagram (placeholder)">
              Instagram
            </a>
            <a className="lh-social-link" href="#" aria-label="YouTube (placeholder)">
              YouTube
            </a>
            <a className="text-secondary" href="/privacy">
              Privacy
            </a>
          </div>
        </div>
      </footer>
    </BrowserRouter>
  )
}
