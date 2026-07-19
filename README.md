# ClinicOS

Multi-tenant clinic management SaaS. See [CLAUDE.md](./CLAUDE.md) for the full product/technical spec and [DECISIONS.md](./DECISIONS.md) for the build/decision log.

**Status: feature-complete (Phases 1–7).** Auth + RBAC + strict tenant isolation, clinic-approval-gated login, subscription-plan feature gating, Super Admin portal, public landing + clinic registration/approval, subscription plans, Clinic Admin (dashboard, staff, settings, reports, audit), Reception (patient registration with duplicate detection, search, appointment booking + walk-in tokens including inline registration of new patients, live queue board, billing + receipts), Clinical (nurse vitals with BMI auto-calc, doctor consultation screen, prescription builder + templates, printable Rx, patient history timeline, doctor schedules/leave), and a lab orders/results module.

## Stack

- **Client**: React 19 + Vite + TypeScript, Tailwind CSS, Framer Motion, React Router, TanStack Query, Zustand, react-hook-form + zod, Recharts
- **Server**: Node.js + Express + TypeScript, `mssql` (raw parameterized SQL, no ORM), JWT auth (access + httpOnly refresh cookie), bcrypt
- **Database**: Microsoft SQL Server, running in a local Docker container

## Prerequisites

- Node.js 20+
- Docker (native Docker on Linux, or Docker Desktop on macOS/Windows — either works)

## 1. Start SQL Server

```bash
docker run -d --name clinicos-mssql \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=DevPass123!" \
  -e "MSSQL_PID=Developer" \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
```

The `clinicos` database does not need to exist beforehand — the migration runner creates it automatically on first run. SQL Server needs ~2GB of RAM available to the Docker host; if the container exits immediately, check `docker logs clinicos-mssql`.

**Note on the SA password**: SQL Server enforces a password policy at container startup — 8+ characters, from at least 3 of {uppercase, lowercase, digit, symbol}. Keep `server/.env`'s `DB_PASSWORD` in sync with whatever you pass to `MSSQL_SA_PASSWORD`.

## 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

The defaults in `server/.env.example` match the `docker run` command above (`sa` / `DevPass123!` on `localhost:1433`, `trustServerCertificate: true` for the container's self-signed cert). Change `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` to real random values for anything beyond local development. The client reads `VITE_API_URL` (defaults to `http://localhost:4000/api/v1`) — no client `.env` is required for local dev.

## 3. Install dependencies

```bash
npm install
```

Installs all workspaces from the root.

## 4. Run migrations and seed data

```bash
npm run db:migrate   # creates the clinicos database if missing, applies all migrations in order
npm run db:seed      # idempotent — safe to re-run, skips if already seeded
```

### Default logins (from seed)

| Role | Username | Password | Lands on |
|---|---|---|---|
| Super Admin | `superadmin` | `ChangeMe123!` | `/admin` |
| Clinic Admin | `clinicadmin` | `Passw0rd!` | `/app` (Dashboard) |
| Doctor | `dr.ahmed` | `Passw0rd!` | `/app` (My Day) |
| Doctor | `dr.fatima` | `Passw0rd!` | `/app` (My Day) |
| Receptionist | `receptionist` | `Passw0rd!` | `/app` (Queue) |
| Nurse | `nurse` | `Passw0rd!` | `/app` (Today) |

(Passwords come from `SUPER_ADMIN_PASSWORD` / `DEMO_USER_PASSWORD` in `server/.env` — change the defaults before this ever runs anywhere but your laptop.)

Also seeded: one approved demo clinic ("Al-Shifa Family Clinic"), 3 subscription plans, 2 doctors with Mon–Fri schedules, 10 sample patients, and appointments for today.

## 5. Run the app

```bash
npm run dev
```

Runs the API on `http://localhost:4000` and the client on `http://localhost:5173` concurrently. Visit `http://localhost:5173` for the public landing page (pricing + "Register your clinic"), or `/login` to sign in as any seeded user.

## Other commands

```bash
npm run test          # server (Vitest + Supertest, requires SQL Server running) + client (Vitest)
npm run test:server   # server RBAC / tenant-isolation / feature tests only
npm run test:client   # client component tests only
npm run build         # type-check and build both workspaces
npm run lint          # lint both workspaces
```

## Features by role

- **Super Admin** (`/admin`): platform dashboard (aggregate-only), clinic approval/suspend, subscription-plan CRUD, plan assignment, platform audit log. Never sees patient/clinical data.
- **Clinic Admin** (`/app`): dashboard with charts, staff management (invite/roles/reset/deactivate; doctors get a linked profile), clinic settings (hours, fees, MR-No format, token/tax settings, prescription header/footer), reports + CSV export, clinic audit log.
- **Reception**: patient registration (CNIC/mobile duplicate detection), fast search, appointment booking from doctor slots or walk-in tokens, live queue board with check-in, reschedule/cancel, billing (invoices, payments, printable receipts), token/patient slips.
- **Doctor**: "My Day" queue, consultation screen (patient summary with allergy alerts + today's vitals + past visits, clinical notes with ICD-10, prescription builder with medicine autocomplete and saved templates, printable prescription), lab orders, patient history timeline, weekly schedule + leave management.
- **Nurse**: today's appointments, vitals entry (BMI auto-calc + abnormal-value highlighting), lab result entry, restricted (summary-only) clinical history.

## API surface (`/api/v1`)

`/auth` (login, refresh, logout, register-clinic), `/admin/plans`, `/admin/clinics`, `/admin/platform` (settings), `/admin/dashboard`, `/admin/audit-log`, `/users` (staff), `/clinic-settings`, `/reports`, `/patients` (+ `/:id/history`, `/duplicates`), `/doctors` (+ `/:id/slots`, `/:id/schedule`, `/:id/leaves`), `/appointments`, `/billing/invoices`, `/vitals`, `/consultations`, `/prescriptions` (+ `/templates`), `/medicines`, `/lab`.

## Access control beyond RBAC

- **Clinic approval gate:** a clinic's staff cannot log in until a Super Admin approves the
  clinic (`Clinics.Status = 'Approved'`). A newly self-registered clinic sits in `Pending` —
  correct credentials still return 403 (`CLINIC_NOT_APPROVED`) until approved. Suspending an
  approved clinic blocks login (and revokes any live session on its next token refresh) too.
- **Plan feature gating:** each `SubscriptionPlans` row carries a `Features` JSON array (e.g.
  `["appointments","billing","reports","lab"]`). The `appointments`, `billing`, `reports`, and
  `lab` API modules are gated behind `requireFeature(...)` middleware — a clinic whose assigned
  plan omits a feature (or has no plan assigned at all) gets 403 (`PLAN_FEATURE_NOT_INCLUDED`)
  on that module, and the corresponding page shows an "upgrade your plan" notice instead of an
  empty list. Core clinical functionality (patients, consultations, vitals, prescriptions) is
  not gated — it's baseline on every plan.

Response envelope: `{ success, data, error, meta }`. Pagination via `?page=&limit=` with `meta: { page, limit, total }`.

## Tenant isolation & RBAC — what's enforced and tested

Per `CLAUDE.md` section 2, every clinic-scoped query is filtered by the `ClinicID` embedded in the caller's JWT — never by a client-supplied id — via `server/src/middleware/tenantScope.ts` and the `assertClinicId` repository guard. Request pipeline: `authenticate → tenantScope → authorize(roles) → (service-level field filtering)`.

The server test suites (run against a real SQL Server instance) cover, per phase:
- Receptionist requesting consultation notes / vitals / clinical fields → `403` / field-stripped
- Super Admin requesting any clinical data → `403`; and its dashboard carries no row-level clinical data
- Cross-clinic access (Clinic A caller, Clinic B resource) → `404` (not `403`, to avoid enumeration)
- Field-level filtering: receptionists never receive `Allergies` / `ChronicConditions` / `BloodGroup`; nurses get a summary-only consultation view
- Role boundaries per module (e.g. only doctors write consultations/prescriptions/lab orders; only reception/admin register patients and bill; only clinic admins manage staff/settings/reports)
- Unauthenticated / malformed token → `401`; login success/failure, lockout, refresh-token cookie issuance

These tests need a live SQL Server connection (they run real migrations and insert/clean up namespaced fixture rows), so start the database first.

## Project structure

```
/client   → React app (Vite): components, features/<domain>, pages/{admin,app,public}, layouts, store, api, utils
/server   → Express API: middleware, modules/<domain> (routes → controller → service → repository), db/{migrations,seeds}, utils
```
