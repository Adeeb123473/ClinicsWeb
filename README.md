# ClinicOS

Multi-tenant clinic management SaaS. See [CLAUDE.md](./CLAUDE.md) for the full product/technical spec.

**Status: Phase 1** — scaffolding, database schema, auth + RBAC + tenant isolation, and the four role-based UI shells (Super Admin, Clinic Admin/Reception/Doctor/Nurse via a shared `ClinicLayout`). No business features yet.

## Stack

- **Client**: React 19 + Vite + TypeScript, Tailwind CSS, Framer Motion, React Router, TanStack Query, Zustand, react-hook-form + zod
- **Server**: Node.js + Express + TypeScript, `mssql` (raw parameterized SQL, no ORM), JWT auth, bcrypt
- **Database**: Microsoft SQL Server, running in a local Docker container

## Prerequisites

- Node.js 20+
- Docker (native Docker on Linux, or Docker Desktop on macOS/Windows — either works)

## 1. Start SQL Server

```bash
docker run -d --name clinicos-sqlserver \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=DevPass123!" \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
```

The `clinicos` database does not need to exist beforehand — the migration runner creates it automatically on first run. SQL Server needs at least ~2GB of RAM available to the Docker host; if the container exits immediately, check `docker logs clinicos-sqlserver`.

**Note on the SA password**: SQL Server enforces a password policy at container startup — 8+ characters, from at least 3 of {uppercase, lowercase, digit, symbol}. Something like `testpass` will cause the container to accept connections briefly and then exit (255) with `Unable to set system administrator password` in its logs. Use a password like the one above, and keep `server/.env`'s `DB_PASSWORD` in sync with whatever you pass to `MSSQL_SA_PASSWORD`.

## 2. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The defaults in `server/.env.example` already match the `docker run` command above (`sa` / `testpass` on `localhost:1433`, `trustServerCertificate: true` for the container's self-signed cert). Change `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` to real random values for anything beyond local development.

## 3. Install dependencies

```bash
npm install
```

This installs all three workspaces (`client`, `server`, `shared`) from the root.

## 4. Run migrations and seed data

```bash
npm run db:migrate   # creates the clinicos database if missing, applies all migrations in order
npm run db:seed      # idempotent — safe to re-run, skips if already seeded
```

Seeding creates:

| Role | Username | Password |
|---|---|---|
| Super Admin | `superadmin` | `ChangeMe123!` |
| Clinic Admin | `clinicadmin` | `Passw0rd!` |
| Doctor | `dr.ahmed` | `Passw0rd!` |
| Doctor | `dr.fatima` | `Passw0rd!` |
| Receptionist | `receptionist` | `Passw0rd!` |
| Nurse | `nurse` | `Passw0rd!` |

(Passwords come from `SUPER_ADMIN_PASSWORD` / `DEMO_USER_PASSWORD` in `server/.env` — change the defaults before this ever runs anywhere but your laptop.)

Also seeded: one approved demo clinic ("Al-Shifa Family Clinic"), 2 doctors with Mon–Fri schedules, 10 sample patients, and appointments for today.

## 5. Run the app

```bash
npm run dev
```

This runs the API on `http://localhost:4000` and the client on `http://localhost:5173` concurrently. Log in as any of the seeded users above — Super Admin lands on `/admin`, everyone else lands on `/app` with a sidebar filtered to their role.

## Other commands

```bash
npm run test          # server (Vitest + Supertest, requires SQL Server running) + client (Vitest)
npm run test:server   # tenant-isolation + RBAC tests only
npm run build          # type-check and build both workspaces
npm run lint            # lint both workspaces
```

## Tenant isolation & RBAC — what's enforced and tested

Per `CLAUDE.md` section 2, every clinic-scoped query is filtered by the `ClinicID` embedded in the caller's JWT — never by a client-supplied id — via `server/src/middleware/tenantScope.ts` and the `assertClinicId` repository guard. Request pipeline: `authenticate → tenantScope → authorize(roles) → (service-level field filtering)`.

`server/tests/tenant-rbac.test.ts` covers, against a real SQL Server instance:
- Receptionist requesting consultation notes → `403`
- Super Admin requesting any clinical data (patient or consultation) → `403`
- Doctor from Clinic A reading a patient or consultation belonging to Clinic B → `404` (not `403`, to avoid resource enumeration)
- Field-level filtering: receptionists never receive `Allergies` / `ChronicConditions` / `BloodGroup` in patient responses; nurses receive a summary-only consultation view
- Unauthenticated / malformed token requests → `401`
- Login: correct/incorrect credentials, validation errors, refresh-token cookie issuance

These tests need a live SQL Server connection (they run real migrations and insert/clean up fixture rows), so start the database first.

## Project structure

```
/client   → React app (Vite) — see client/README.md for frontend-specific notes
/server   → Express API
/shared   → shared types/schemas (not yet populated)
```
