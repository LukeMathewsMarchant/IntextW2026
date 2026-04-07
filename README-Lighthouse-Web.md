# Light on a Hill Foundation — Lighthouse.Web (ASP.NET Core MVC + React)

Visual design is aligned with the reference mockups in [`UI_Examples/`](../UI_Examples) (landing page, scrolled impact section, and dashboard screens). The logo asset should be placed at `backend/Lighthouse.Web/wwwroot/img/Logo.png` for serving (and `frontend/public/img/Logo.png` for Vite dev).

This project implements the INTEX scaffold: **ASP.NET Core MVC** (controllers + Razor layouts), **React (Vite + TypeScript)** in [`frontend/`](../frontend) embedded in views, **ASP.NET Core Identity** with roles **Admin** and **Donor**, **PostgreSQL** (Supabase) using the case schema in [`database_setup/schema.sql`](database_setup/schema.sql), plus **admin audit logging**, **CSP**, and **Serilog** file logs under [`backend/Lighthouse.Web/Logs`](backend/Lighthouse.Web/Logs).

## Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) (10.x, matching the project)
- Node.js 20+ (for the React client)
- PostgreSQL with the **case schema and seed already applied** (see `database_setup/`). Identity tables and `admin_audit_logs` are created by EF Core migrations.

## Configuration

1. Copy [`.env.example`](.env.example) to **`.env`** at the **repository root** (same folder as `Lighthouse.sln`).
2. Set `ConnectionStrings__DefaultConnection` to your Supabase connection string (SSL required for hosted Supabase).
3. Optionally set `Seed__AdminEmail` and `Seed__AdminPassword` (password must meet the 12+ character Identity policy) to create an initial **Admin** user on startup.

In **Development**, `Program.cs` loads `.env` from the repo root. In production, use environment variables or your host’s secret store (not committed `.env` files).

## Database order of operations

1. In Supabase SQL editor, run `database_setup/schema.sql`, then `database_setup/seed_data.sql` (see [`database_setup/database_setup.md`](database_setup/database_setup.md)).
2. Run EF migrations so **AspNet\*** tables, **`admin_audit_logs`**, and the **FK from `AspNetUsers.SupporterId` → `supporters`** exist:

```powershell
cd backend
dotnet ef database update
```

Use `dotnet tool run dotnet-ef` from the repository root if the local tool manifest is present.

> If the database is empty, migrations that reference `supporters` will fail until the case schema exists.

## Styling note (Vite vs ASP.NET)

The React app **imports Bootstrap and the backend `wwwroot/css/site.css` in `frontend/src/main.tsx`**, so **`npm run dev`** (Vite at `http://localhost:5173`) matches the design system even though that dev server does **not** use Razor `_Layout.cshtml` (which is why the UI looked unstyled before: Vite’s `index.html` had no CSS links).

For the full experience (server nav, logo, auth links in the chrome), run the ASP.NET app and use the Vite dev URL below, or browse the API directly at `http://localhost:5182`.

## Run locally

**Terminal 1 — API:**

```powershell
cd backend
dotnet run
```

**Terminal 2 — React (optional, HMR):**

```powershell
cd frontend
npm run dev
```

Browse **`http://localhost:5173`** for the React app with hot reload. The Vite dev server proxies `/api`, `/Account`, `/Donor`, and `/Admin` to `http://localhost:5182`.

**Production-style React bundle:**

```powershell
cd frontend
npm run build
```

Output is written to `backend/Lighthouse.Web/wwwroot/app/` and loaded by [`Views/Shared/ReactApp.cshtml`](backend/Lighthouse.Web/Views/Shared/ReactApp.cshtml).

## Roles

- **Admin**: `/Admin/*`, `/api/admin/*` (full CRUD over case tables + audit/OKR endpoints).
- **Donor**: `/Donor/*`, `/api/donor/*` (requires `SupporterId` on the user for personalized donation queries).

Public registration creates **Donor** accounts only. Admins are created via seed credentials or operator provisioning.

## Deployment notes (Vercel + API)

Vercel is ideal for **static frontends** and serverless Node workloads. A full **ASP.NET Core MVC** app (Razor + Kestrel) is typically hosted on **Azure App Service**, **Render**, **Railway**, or similar, with HTTPS and environment-based connection strings. You can still deploy the **Vite build** to Vercel as a static site that calls a separately hosted API (configure CORS and cookie `SameSite` appropriately), or ship the API and MVC together on a container-friendly host.

## EF Core and excluded tables

Domain tables from the case SQL script are mapped in EF Core but marked **excluded from migrations** so `dotnet ef` does not recreate them. Only Identity tables and `admin_audit_logs` are managed by migrations.
