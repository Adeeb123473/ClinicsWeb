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
