import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CookieBanner } from './components/CookieBanner'
import { About } from './pages/About'
import { AdminAnalytics } from './pages/AdminAnalytics'
import { AdminAudit } from './pages/AdminAudit'
import { AdminCrud } from './pages/AdminCrud'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminOkr } from './pages/AdminOkr'
import { Contact } from './pages/Contact'
import { DonorDashboard } from './pages/DonorDashboard'
import { DonorHistory } from './pages/DonorHistory'
import { DonorInsights } from './pages/DonorInsights'
import { Privacy } from './pages/Privacy'
import { PublicHome } from './pages/PublicHome'
import { Impact } from './pages/Impact'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <CookieBanner />
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/impact" element={<Impact />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/Donor" element={<DonorDashboard />} />
        <Route path="/Donor/History" element={<DonorHistory />} />
        <Route path="/Donor/Insights" element={<DonorInsights />} />
        <Route path="/Admin" element={<AdminDashboard />} />
        <Route path="/Admin/Crud/:entity" element={<AdminCrud />} />
        <Route path="/Admin/Audit" element={<AdminAudit />} />
        <Route path="/Admin/Okr" element={<AdminOkr />} />
        <Route path="/Admin/Analytics" element={<AdminAnalytics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
