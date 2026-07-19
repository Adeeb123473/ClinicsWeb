# DECISIONS.md — ClinicOS build log

Autonomous build decisions where CLAUDE.md left a choice. Newest phase last.

## Infrastructure / verification

- **Database in this environment:** CLAUDE.md fixes the stack on Microsoft SQL Server.
  The sandbox had no SQL Server, so one was provisioned via Docker
  (`mcr.microsoft.com/mssql/server:2022-latest`, Developer edition) on `localhost:1433`
  with the credentials from `server/.env.example`. All migrations, seeds, and the full
  server test suite (including tenant-isolation / RBAC tests) run against it. This is a
  dev/CI convenience only — production connection details come from `.env`.
- **Language:** TypeScript on both client and server, per CLAUDE.md's stated preference.
- **Testing:** Vitest + Supertest (server), Vitest + React Testing Library (client),
  matching the Phase-1 setup already in the repo. Server tests spin up the real Express
  app and the real database; each test run namespaces its fixtures with a run-id so runs
  are independent and repeatable.

## Phase 2 — Super Admin portal, landing page, registration, plans

- **Public clinic registration** creates the `Clinic` in `Pending` status plus a single
  `CLINIC_ADMIN` user in one transaction. The clinic cannot log in usefully until a Super
  Admin approves it (login is allowed but a `Pending`/`Suspended` clinic is surfaced to the
  admin so they know to wait). Registration is unauthenticated and rate-limited.
- **Clinic status lifecycle:** `Pending → Approved → Suspended ⇄ Approved`, plus `Inactive`.
  Approving sets status `Approved`; reject/suspend are distinct actions. These are the four
  states already constrained in the `Clinics` table.
- **Super Admin dashboard** returns only aggregate counts (clinic counts by status, user
  counts by role, today's appointment volume, MRR by plan) — never any row-level patient or
  clinical data, per the section-2 privacy boundary.
- **Plans:** full CRUD on `SubscriptionPlans`, Super-Admin only. Deleting a plan that is in
  use is blocked (409) to preserve referential integrity; deactivate instead.
