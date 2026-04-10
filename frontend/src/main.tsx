// Vite + React entry: mounts the SPA under #root. Production builds are copied into Lighthouse.Web/wwwroot/app.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Bundled styles so Vite dev (index.html without Razor _Layout) matches MVC + design system
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import '@webrootcss/site.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
