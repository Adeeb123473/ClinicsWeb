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

## Phase 3 — Clinic Admin

- **Staff creation** provisions a linked `Doctors` row in the same transaction when the new
  user's role is DOCTOR (specialization, fees, room). New staff are created with
  `MustChangePassword = 1`.
- **Self-lockout guard:** a clinic admin cannot set their own account to Inactive.
- **Clinic settings** are stored as two JSON blobs on `Clinics` (`OperatingHours`, `Settings`).
  The `Settings` blob is the single source of truth for `mrNoFormat`, `tokenResetDaily`,
  `taxPercent`, `currency`, `invoicePrefix`, and the prescription header/footer — later phases
  read it via `loadClinicSettings()`. Any clinic role may READ settings (needed for currency,
  prescription header, etc.); only CLINIC_ADMIN may WRITE them.
- **Reports** are CLINIC_ADMIN-only and clinic-scoped: dashboard aggregates, 14-day appointment
  trend, 30-day doctor workload / status mix, revenue-by-day, and CSV export for patients and
  appointments (server-side CSV via a shared `toCsv` util).
- **Currency default** is PKR ("Rs") given the South-Asian target market; configurable per clinic.

## Phase 4 — Reception

- **MR number generation** is per-clinic, per-year, derived from the max existing 4-digit
  sequence under a SERIALIZABLE transaction with UPDLOCK/HOLDLOCK; the (ClinicID, MRNo)
  unique constraint is the backstop. Format comes from clinic settings (`mrNoFormat`).
- **Duplicate detection** matches exact CNIC or mobile within the clinic. Registration returns
  409 (`DUPLICATE_PATIENT`) unless the caller passes `forceDuplicate: true` ("different person").
- **Age** is always computed from DOB at read time (never stored as source of truth); the
  response carries a `currentAge {value, unit}` derived field.
- **Token allocation** is per doctor per day: next = max(TokenNo)+1 under a SERIALIZABLE
  transaction, guarded by the (ClinicID, DoctorID, Date, TokenNo) unique constraint. Walk-ins
  omit a slot time and default to the current time.
- **Appointment status** is a state machine enforced server-side
  (Scheduled→CheckedIn→InConsultation→Completed, plus Cancelled/NoShow); illegal transitions 400.
- **Billing:** invoice numbers are `${prefix}-${year}-${5-digit seq}` (SERIALIZABLE); tax comes
  from clinic settings; recording a payment re-derives PaidAmount and Paid/PartiallyPaid status
  atomically; over-payment beyond the outstanding balance is rejected (400).
- **Printing** is handled client-side by opening a self-contained print window (token slip,
  patient card, receipt) with monospace/thermal-friendly CSS — no server PDF dependency.
- **Field filtering** is preserved end-to-end: receptionists never receive (or see a form for)
  Allergies/ChronicConditions/BloodGroup.

## Phase 5 — Clinical

- **BMI** is computed server-side from weight/height on every vitals write (never trusts a
  client value), so the stored/displayed BMI can't disagree with the recorded measurements.
  Abnormal-range highlighting is a client concern layered on the raw values.
- **Consultation ↔ appointment** is 1:1 (unique AppointmentID). Writing a consultation upserts
  on the appointment, so "Save" is idempotent and safe to call repeatedly during a visit.
- **Prescriptions** are versioned: saving replaces the consultation's prescription by
  soft-deleting the prior one and inserting a fresh set of items in a transaction.
- **Prescription templates** are per-doctor (scoped by ClinicID + DoctorID), stored as a JSON
  item array; a new migration (024) adds the `PrescriptionTemplates` table.
- **Role filtering** on clinical reads: nurses get a summary-only consultation view (chief
  complaint, diagnosis, follow-up — no examination notes / HPI / treatment plan); receptionists
  are blocked entirely; the patient history endpoint is doctor/nurse/admin only.
- **Doctor schedule/leave** ownership: a doctor may manage only their own; a clinic admin may
  manage any — enforced in the controller by matching the doctor's UserID to the caller.
- The client resolves "my" doctor profile by matching the authenticated user's full name to
  DoctorName (they are kept in sync on staff create/update), avoiding an extra /doctors/me call.

## Phase 6 — Notifications & Lab (billing/reports completed earlier)

- **Billing and reports** were delivered in Phases 3–4 (invoices/payments/receipts, revenue
  charts, CSV export); Phase 6 adds notifications and the lab module.
- **In-app notifications** are a lightweight per-user table. `notify()` is fire-and-forget
  (failures are swallowed so a notification write never breaks the triggering action). Events
  wired up: appointment booked → treating doctor; patient checked in → treating doctor; lab
  result recorded → ordering doctor. The client polls every 30s and marks all read on open.
- **Lab module:** tests master (doctors/admins manage, all clinical roles read), orders
  (doctors order; nurses/admins record results and update status). Recording a result upserts
  the `LabResults` row, flips the order to `Completed`, and notifies the ordering doctor.
  Receptionists have no lab access.

## Phase 7 — Polish

- Most polish was built incrementally across phases: Framer Motion (sidebar stagger, modal &
  toast springs, animated stat counters, staggered table rows, queue/timeline layout
  animations), loading skeletons (Table) and spinners, empty states everywhere, and a global
  `prefers-reduced-motion` CSS reset plus `useReducedMotion()` guards in animated components.
- This pass adds: route-level page transitions in the app shell (fade/slide, reduced-motion
  aware), a reusable `ErrorState` with a retry action wired into the dashboards, and an
  `@media print` stylesheet that drops the sidebar/topbar chrome if an in-app page is printed
  directly (the token slip / receipt / prescription printing continues to use isolated windows).
- Dark mode was intentionally left out (CLAUDE.md marks it a nice-to-have after core features).

## Follow-up — Platform Settings & Announcements (completing Phase 2)

- The Super Admin **Platform Settings** page was left as a placeholder in the original Phase 2
  pass and is now implemented (CLAUDE.md §4, Super Admin item 4).
- **Platform settings** are a single-row JSON blob (`PlatformSettings`, migration 025):
  `platformName`, `supportEmail`, `allowClinicRegistration`, `maintenanceMode`. Turning
  `allowClinicRegistration` off makes public `POST /auth/register-clinic` return 403
  (`REGISTRATION_DISABLED`).
- **Announcements** (`Announcements` table) are created by the Super Admin with a level
  (info/warning/critical) and optional start/end window. Active ones are served to any
  authenticated clinic user via `GET /announcements/active` and rendered as a dismissible
  banner at the top of the clinic shell (all clinic dashboards).
- **Test determinism:** because `PlatformSettings` is a true singleton shared across suites,
  server tests now run with `fileParallelism: false` so the registration-toggle test can't race
  the Phase-2 registration tests. The platform test seeds a real SUPER_ADMIN user so the
  `CreatedBy`/`UpdatedBy` foreign keys resolve.

## Follow-up — Notifications/Announcements removal, clinic-approval login gate, plan feature gating

- **Removed the in-app notifications and platform-announcements features** entirely per explicit
  request: server modules (`modules/notifications`, the `Announcements` half of `modules/platform`),
  client components (`NotificationBell`, `AnnouncementBanner`), all wiring (appointment-booked /
  checked-in / lab-result-ready notify() calls, the topbar bell, the dashboard banner), and their
  routes (`/notifications`, `/announcements/active`, `/admin/platform/announcements`). Migration
  026 drops the `Notifications` and `Announcements` tables — per the "never edit an applied
  migration" rule, this is a new migration rather than editing 022/025. `PlatformSettings`
  (platform name, support email, registration toggle, maintenance flag) is unrelated and kept.

- **Fixed a real gap: clinic-approval-gated login.** `auth.service.ts` previously only checked
  `Users.Status`, never the parent `Clinics.Status` — a newly self-registered CLINIC_ADMIN could
  log in immediately, before Super Admin approval. Now, after password verification succeeds
  (checked post-password so a wrong password never leaks clinic-approval state), a non-Approved
  clinic (`Pending`/`Suspended`/`Inactive`) is rejected with 403 `CLINIC_NOT_APPROVED` and a
  status-specific message. The same check runs on refresh, so a clinic suspended mid-session has
  its refresh token revoked rather than being able to keep renewing its session. SUPER_ADMIN
  (`ClinicID = NULL`) is exempt.

- **Implemented plan-based feature gating** (`SubscriptionPlans.Features` existed since Phase 2
  but was never enforced anywhere). Added `requireFeature(feature)` middleware
  (`middleware/planFeature.ts`) that loads the clinic's assigned plan's `Features` JSON and 403s
  with `PLAN_FEATURE_NOT_INCLUDED` if the feature isn't listed — **fails closed**: a clinic with
  no plan assigned gets zero gated features, not everything. Applied to the four modules that
  map onto the seed data's feature flags: `appointments`, `billing`, `reports`, `lab`. Core
  clinical functionality (patients, consultations, vitals, prescriptions, staff, doctors) is
  deliberately left ungated — it's baseline functionality on every plan, matching the seed
  data model (Starter/Professional/Enterprise all differ only in these four flags plus `api`).
  Frontend: a reusable `PlanUpgradeNotice` component replaces the empty-list state on the five
  pages backed by gated modules (Reports, Billing, Lab, Appointments, Queue) when the API returns
  that error code, instead of silently rendering an empty table.

- **Verified doctor prescription recording** end-to-end live (book → consultation → prescription
  write → read-back, nurse correctly blocked from writing) — unaffected by the above changes.

- **Added walk-in appointment booking without a separate registration step.** `BookAppointmentModal`
  gained an "Existing patient" / "New / walk-in patient" toggle; the new-patient path collects the
  minimal required fields (name, gender, DOB, optional mobile/CNIC) and calls the existing
  `POST /patients` then `POST /appointments` endpoints in sequence — no new backend endpoint, pure
  client-side orchestration of two already-tested calls. The server's CNIC/mobile duplicate
  detection still runs (a truly duplicate walk-in is rejected with a 409, prompting the
  receptionist to search for the existing record instead of creating a second one).

- **Fixed a real gap: a patient's full prescription history was write-only.** `POST /prescriptions`
  worked (doctors could record a prescription against a consultation), but there was no way to
  read a patient's prescriptions across all their past consultations — `prescriptions.repository.ts`
  only supported a single-consultation lookup, and `patientHistory` (the `GET /patients/:id/history`
  endpoint backing both the consultation screen and patient detail page) omitted prescriptions
  entirely, despite CLAUDE.md explicitly listing "consultations, prescriptions, vitals, lab results"
  as the required timeline. Added `listPrescriptionsForPatient` (joins `Prescriptions` →
  `Consultations` → `Doctors`, batches the `PrescriptionItems` lookup in one query instead of N+1)
  and wired it into three places: (1) `patientHistory`'s response now includes a `prescriptions`
  array alongside `consultations`/`vitals`; (2) `GET /prescriptions` now also accepts a `patientId`
  query param (mirroring the existing `consultations` route's `patientId`/`appointmentId` branch)
  for a standalone prescription-history lookup; (3) both use the same RBAC as consultations —
  CLINIC_ADMIN/DOCTOR/NURSE can read, RECEPTIONIST and SUPER_ADMIN are blocked (403), since
  prescriptions are clinical data. Frontend: the consultation screen's sidebar gained a "Previous
  prescriptions" card (medicine chips per past visit) so a doctor sees prior prescriptions while
  writing a new one, and the patient detail page's Timeline component gained a third event type
  (pill icon) merging prescriptions in chronologically with consultations and vitals. Verified
  live: a second appointment/consultation/prescription for one patient shows up correctly ordered
  in both the `GET /patients/:id/history` and `GET /prescriptions?patientId=` responses, and in
  the rendered UI (screenshots taken via Playwright against the dev server).

- **Added support for hosted/managed SQL Server (not just local Docker).** `getPool()`
  unconditionally called `ensureDatabaseExists()`, which connects to `master` and runs
  `CREATE DATABASE` if missing — fine for a local `sa` login, but shared/managed SQL hosts
  (SmarterASP.NET, Azure SQL, etc.) provision the database up front and the app's login typically
  has no access to `master` at all, so every server start would fail. Added `DB_AUTO_CREATE_DATABASE`
  (default `"true"`, so local Docker dev is unaffected); set to `"false"` for a hosted database and
  `getPool()` connects straight to `DB_NAME` and skips the `master`/`CREATE DATABASE` step —
  `npm run db:migrate` then builds the schema inside the already-provisioned database. Documented
  the ADO.NET-connection-string → `DB_*` env var mapping in `server/.env.example` and a short
  README section. Verified: full server suite (73 tests) still passes unchanged against local
  Docker with the flag left at its default. Live connectivity to an actual hosted instance could
  not be verified from this sandbox — outbound raw TCP to a non-standard external host times out
  here (this environment's network policy routes HTTPS only), so this needs a real connectivity
  check from the user's own machine or deployment target.

- **Prepared the `server` workspace for standalone hosting on Render.** Several things only
  matter once the API and frontend live on different domains behind a real PaaS, and none of
  them were exercised by local dev or the test suite:
  - **Found and fixed a real deploy-breaking bug**: `tsc` only compiles `.ts` files, so the
    `.sql` migration files were never copied into `dist/` — `npm run build && npm start` (what
    Render actually runs) crashed on boot with `ENOENT: .../dist/db/migrations`. Local dev
    (`tsx`, which runs `src/` directly) and the test suite (also against `src/`) never touched
    the compiled output, so this was invisible until a real production-build boot was tried.
    Fixed by adding a copy step to the `build` script (`fs.cpSync` via `node -e`, no new
    dependency) — verified by rebuilding from a clean `dist/` and booting the compiled output.
  - **Migrations now run automatically on every boot** (`index.ts` calls the already-idempotent
    `runMigrations()` before `app.listen`), so a fresh deploy against an empty-but-provisioned
    hosted database is self-sufficient — no separate migrate step needed on a host without shell
    access. Seed data is deliberately *not* auto-run (it's a one-time, explicit `npm run
    db:seed`) — auto-seeding would silently inject demo patients/clinics into whatever database
    is configured, which is fine for a throwaway local DB but not something to do unprompted
    against a real hosted one.
  - **`app.set("trust proxy", 1)`**: Render sits in front of the app behind a reverse proxy;
    without this, `express-rate-limit` and every `req.ip` read (login lockout tracking, audit
    logs) would see the proxy's IP for every request instead of the real client's.
  - **CORS now supports a whitelist** (`CLIENT_ORIGIN` is comma-separated) instead of a single
    origin string, since a hosted deployment needs the deployed frontend's domain (and possibly
    a preview/custom domain later) rather than just `localhost:5173`. An origin not on the list
    simply doesn't get CORS headers back (silent browser-side block) rather than erroring the
    request — avoids turning routine bot/scanner traffic with a random `Origin` header into
    noisy 500s in the logs.
  - **Refresh-token cookie is `SameSite=None` in production** (still `Lax` in dev). The frontend
    and API will be on two different domains once both are hosted, and `Lax` cookies are not
    sent on cross-site fetch/XHR — only `None` (which requires `Secure`, already true in
    production) works there. Verified live: booted the compiled `dist/` build with
    `NODE_ENV=production`, confirmed `/health`, an allowed-origin CORS preflight, a
    disallowed-origin preflight (200, no CORS headers, no error), and a real login response's
    `Set-Cookie: ...; Secure; SameSite=None`.
  - Pinned `"engines": {"node": ">=20"}` in `server/package.json` itself (previously only on the
    root package.json) so Render picks the right Node version when its Root Directory is set to
    `server` rather than the repo root.

- **Fixed the actual first Render build failure: missing devDependencies at build time.** The
  live build log showed `tsc` running but failing on every file with `TS7016 Could not find a
  declaration file for module 'express'` (and `TS2584 Cannot find name 'console'`, from a missing
  `@types/node`) — classic symptom of `devDependencies` never being installed. Cause: Render
  reuses the same env vars for both the build step and the running app, so the `NODE_ENV=production`
  we told the user to set (needed at runtime) also makes `npm install` skip devDependencies during
  the build — and `tsc`/`@types/*` are devDependencies, since nothing from them is needed once
  `dist/` is compiled. Fixed by changing the Build Command to
  `npm install --include=dev && npm run build`, which always installs devDependencies for that one
  install regardless of `NODE_ENV`. Also added `render.yaml` at the repo root so this (plus root
  directory, start command, health check path, and the non-secret env vars) is captured as code
  instead of a set of dashboard fields someone has to remember/re-enter; secret values
  (`DB_PASSWORD`, JWT secrets, etc.) are declared with `sync: false`/`generateValue: true` rather
  than committed. The rest of that build log's errors (several `TS7006 implicitly has an 'any'
  type` in repository files) were downstream fallout from the same missing-types root cause, not
  real bugs — confirmed by a clean local `npm run build` throughout this work.

- **Prepared the `client` workspace for standalone hosting on Vercel**, once the API was
  confirmed live at `https://clinicsweb.onrender.com`. Client code needed no changes — `VITE_API_URL`,
  `withCredentials: true` on the axios instance, and a `.env.example` were all already in place
  from earlier work. Added `client/vercel.json` with an explicit SPA rewrite (`/(.*) → /index.html`):
  without it, Vercel's static file server 404s on a hard refresh of any client-side route
  (`/app/patients/:id`, `/login`, etc.) since only `index.html` exists as a literal file — React
  Router needs every unmatched path routed there so it can take over client-side. Also pinned
  `engines.node` in `client/package.json`, matching the server. Unlike Render, Vercel always
  installs `devDependencies` during its build step regardless of `NODE_ENV`, so the
  `--include=dev` workaround needed for Render doesn't apply here. Documented in README that
  after deploying, `CLIENT_ORIGIN` on the Render service must be updated to the resulting
  `*.vercel.app` URL — until then the API's CORS whitelist (added earlier) rejects the deployed
  frontend's requests even though the static site itself loads fine. Verified: clean client
  build/lint/test locally; live end-to-end verification of the Render URL was not possible from
  this sandbox — its network policy explicitly denies the CONNECT to `clinicsweb.onrender.com`
  (confirmed via the proxy's own status endpoint, `recentRelayFailures: connect_rejected`), same
  class of sandbox limitation as the earlier hosted-SQL-Server connectivity check.

- **Made the shared `AppShell` (sidebar + topbar chrome used by every dashboard) actually
  responsive.** It was reported as "not responsive," and the real cause was the layout shell, not
  any one dashboard page — the sidebar was a permanent flex item (76–248px depending on the
  desktop collapse toggle) at every viewport width, so on a phone it just squeezed the content
  column into a sliver rather than adapting. Fixed by making the sidebar `fixed` + off-canvas
  (`-translate-x-full`) below the `lg` breakpoint with a dimmed backdrop and a hamburger toggle in
  the topbar, while `lg:static lg:translate-x-0` restores the exact previous desktop behavior
  unchanged (including the existing mini-sidebar collapse toggle, now hidden below `lg` since a
  collapsed *and* off-canvas sidebar doesn't make sense together — the mobile drawer just opens at
  full width). The drawer closes by clicking the backdrop or following a nav link (a direct
  `onClick` on each `NavLink`, not a `useEffect` on the route — the project's eslint config flags
  `setState` inside an effect body as a lint error, and closing on the action that caused the
  navigation is the more direct fix anyway). Also trimmed the topbar's padding/gaps and hid the
  "Log out" text label below `sm` (icon-only, with an `aria-label` so it stays accessible) since
  every dashboard page's own grids (`sm:grid-cols-2 xl:grid-cols-4`, Recharts
  `ResponsiveContainer`, the shared `Table` component's own `overflow-x-auto`) were already
  responsive and just needed the shell around them to stop fighting them. Since `AppShell` is
  shared by both `ClinicLayout` and `SuperAdminLayout`, this one change fixes every role's
  dashboard (and every other page) at once. Verified live via Playwright at 375px (mobile), 820px
  (tablet), and 1440px (desktop) for both a Clinic Admin and the Super Admin: no horizontal page
  overflow at any width, drawer opens/closes correctly and closes on nav-link click, desktop
  collapse toggle and layout pixel-identical to before.

- **Added an explicit close (✕) button inside the mobile drawer itself**, next to the brand
  label. The topbar's hamburger button occupies roughly the same top-left screen region the
  drawer slides into, so once the drawer is open it visually sits on top of (and is drawn above)
  that button — there's no way to "tap the hamburger again" to close it, only tap-outside
  (backdrop) or follow a nav link. Rather than fighting z-index/stacking-context rules to keep the
  original button reachable through the open drawer, added a dedicated close affordance inside the
  drawer's own header — the conventional pattern for off-canvas mobile nav (hamburger to open, ✕
  inside the panel to close, tap-outside also closes). Verified via Playwright: hamburger opens
  the drawer, the new ✕ closes it, reopening and tapping the backdrop also closes it — all three
  paths confirmed by checking the aside's actual on-screen bounding box, not just that a click
  handler fired.

- **Made the consultation fee editable per-booking, and confirmed it was already optional at
  doctor registration.** `Doctors.ConsultationFee` was only ever a per-doctor default with no way
  to override it for one visit (e.g. a Deserving-category waiver, a negotiated discount) — and
  appointments/invoices are two entirely separate flows here (invoices are free-form line items,
  not derived from the appointment), so there was nowhere to even record a one-off fee. Added a
  nullable `ConsultationFee` column on `Appointments` (migration 027; `NULL` = "use the doctor's
  standard fee"), threaded through `bookSchema` → service → repository → the `AppointmentDto`.
  `BookAppointmentModal` now shows an editable "Consultation fee" field that prefills from the
  selected doctor's standard fee (using `followUpFee` specifically when the visit type is
  `FollowUp`) whenever the doctor or visit type changes, and re-sends whatever value is in the
  field at submit time — reception can freely override it before booking. Registration-time fee
  optionality was in fact already correct server-side (`createStaffSchema`'s `consultationFee` was
  always `z.number().min(0).optional()`, defaulting to 0) — the only real gap was cosmetic: the
  client labels just said "Consult fee" / "Follow-up fee" with no indication they could be left
  blank, unlike the neighboring Email/Phone fields which already said "(optional)". Fixed the
  labels to match and added a "Defaults to 0" hint. Verified live via Playwright: selecting a
  doctor prefills the fee from `Doctor.consultationFee`, editing and booking persists the override
  (also covered by a new backend test asserting the stored value on read-back vs. `null` when
  omitted — 74 server tests passing, up from 73), and creating a doctor with both fee fields left
  blank succeeds without any validation blocking submission.
