# CLAUDE.md — ClinicOS: Multi-Tenant Clinic Management System (SaaS)

This file guides Claude Code when working on this repository. Read it fully before writing any code. Follow every rule here unless the user explicitly overrides it.

---

## 1. Project Overview

ClinicOS is a **multi-tenant SaaS web application** for managing clinics. Multiple independent clinics register on the platform; each clinic operates in a fully isolated sandbox and manages its own patients, appointments, consultations, prescriptions, billing, and staff. The application will be sold commercially as a SaaS product, so code quality, security, tenant isolation, and UI polish are all first-class requirements — not afterthoughts.

**Target market context:** Fields like CNIC (national ID), MR No (Medical Record Number), Father/Husband Name, Token No, and Visit Type (Deserving/Private) indicate a South Asian clinic workflow (walk-in token queues, charity/deserving patient categories). Support these natively, but keep labels configurable per clinic where practical.

### Tech Stack (fixed — do not substitute)
| Layer | Technology |
|---|---|
| Frontend | React.js (Vite), React Router, TanStack Query, Zustand (or Redux Toolkit), Tailwind CSS, Framer Motion (animations), Recharts (charts), react-hook-form + zod |
| Backend | Node.js + Express.js (REST API) |
| Database | Microsoft SQL Server (use `mssql` npm package or Sequelize/Prisma with SQL Server dialect) |
| Auth | JWT (access + refresh tokens), bcrypt password hashing |
| Real-time (optional) | Socket.IO for live token queue / appointment board |
| Validation | zod (shared schemas between FE/BE where possible) |
| Testing | Vitest / Jest + Supertest (API), React Testing Library |

### Repository Structure (monorepo)
```
/client            → React app (Vite)
  /src
    /api           → API client, axios instance, query hooks
    /components    → shared UI components
    /features      → feature folders (auth, patients, appointments, ...)
    /layouts       → role-based layouts (SuperAdminLayout, ClinicLayout, ...)
    /pages
    /store         → Zustand stores
    /utils
/server            → Express API
  /src
    /config        → db pool, env config
    /middleware    → auth, rbac, tenantScope, errorHandler, auditLog
    /modules       → feature modules, each with routes/controller/service/repository
    /db
      /migrations  → versioned SQL migration scripts
      /seeds       → seed data (roles, demo clinic, super admin)
    /utils
/shared            → shared zod schemas & TypeScript types (if TS is used)
```

Prefer **TypeScript** on both client and server unless the user says otherwise.

---

## 2. Roles & Permissions (RBAC) — CRITICAL

Implement a strict role-based access control system. Roles:

### Platform level
- **SUPER_ADMIN** (the SaaS owner)
  - Manages clinic registration & approval (approve / reject / suspend clinics)
  - Manages subscription plans & billing tiers, assigns plans to clinics
  - Views system-wide analytics: number of clinics, active users, appointment volumes, revenue metrics
  - Global configuration (plans, feature flags, announcements)
  - **PRIVACY BOUNDARY:** Super Admin must NEVER be able to read patient medical histories, consultation notes, diagnoses, prescriptions, or vitals. API endpoints serving clinical data must reject SUPER_ADMIN. Analytics for Super Admin must be aggregate counts only — never row-level patient/clinical data.

### Clinic level (tenant-scoped)
- **CLINIC_ADMIN** (practice manager)
  - Full management of their own clinic: profile, operating hours, departments, fee structure
  - Invites/creates users (doctors, receptionists, nurses), assigns roles, activates/deactivates accounts
  - Views clinic reports: appointment trends, revenue, doctor workload, patient registration stats, user activity logs
  - Full access to administrative data within their clinic only
- **DOCTOR**
  - Views full medical profiles of patients in their clinic
  - Logs consultations: chief complaint, examination notes, diagnosis (support ICD-10 code field), treatment plan
  - Writes prescriptions (medicines with dosage, frequency, duration, instructions)
  - Orders lab tests and records/reviews results
  - Manages own availability calendar (working days, slots, leave)
  - Views own appointment queue for the day
- **RECEPTIONIST**
  - Registers new patients (demographics, contact, CNIC, insurance, category)
  - Schedules / reschedules / cancels appointments; issues Token No
  - Checks patients in on arrival; manages the day's queue
  - Handles billing: creates invoices, records payments, prints receipts
  - **RESTRICTION:** must NOT see consultation notes, diagnoses, detailed prescription history, or lab results. Patient detail API responses for receptionists must omit clinical fields entirely (field-level filtering on the server, not just hidden in the UI).
- **NURSE** (medical assistant)
  - Looks up today's/upcoming appointments
  - Records vitals before consultation: blood pressure, pulse, temperature, weight, height, BMI (auto-calc), SpO2, blood sugar
  - Read access to basic medical history (allergies, chronic conditions, current medications)
  - Restricted/read-only access to past consultation notes (configurable per clinic; default = summary only)

### RBAC implementation rules
1. Enforce permissions **on the server** with middleware: `authenticate → attachTenant → authorize(roles...) → fieldFilter(role)`. UI-level hiding is cosmetic only and never sufficient.
2. Every table containing tenant data has a `ClinicID` column. Every query must filter by the `ClinicID` from the authenticated JWT — never from request body/params. Write a `tenantScope` helper/repository layer so it is impossible to forget.
3. Users belong to exactly one clinic (`ClinicID` on Users). SUPER_ADMIN has `ClinicID = NULL`.
4. A user from Clinic A requesting a resource of Clinic B → return **404** (not 403), to avoid resource enumeration.
5. Write automated tests specifically for tenant isolation and role boundaries (e.g., receptionist requesting consultation notes → 403; doctor from clinic A reading patient of clinic B → 404; super admin requesting a consultation → 403).

---

## 3. Database Schema (SQL Server)

Use the uploaded field requirements as the **minimum** schema. All names below are the required source fields; extend with sensible additions. Use `INT IDENTITY` or `UNIQUEIDENTIFIER` PKs, proper FKs, and indexes on (`ClinicID`, frequently queried columns).

### Required core tables (from provided spreadsheet)

**Clinics**
- ClinicID (PK), ClinicName, Address, Phone, Status (Pending/Approved/Suspended/Inactive), CreatedDate
- Extend: Email, LogoUrl, OperatingHours (JSON), SubscriptionPlanID, SubscriptionExpiry, TimeZone, Settings (JSON)

**Users**
- UserID (PK), Username (unique per system), PasswordHash (bcrypt — never plaintext), Role, ClinicID (FK, NULL for super admin), Status
- Extend: FullName, Email, Phone, LastLoginAt, MustChangePassword, RefreshTokenHash, CreatedAt/By, UpdatedAt/By

**Patients**
- ClinicID (FK), PatientID (PK), MRNo (auto-generated, unique **per clinic**, format configurable e.g. `MR-{YYYY}-{seq}`), RegistrationDate, RegistrationTime, PatientName, FatherHusbandName, Gender, ActualDOB (nullable), EstimatedDOB (nullable), AgeAtRegistration, AgeUnit (Years/Months/Days), MobileNo, CNIC, Address, Category (e.g., General/Deserving/Staff/Insurance), Remarks, CreatedBy, CreatedDate, CreatedTime, UpdatedBy, UpdatedDate, UpdatedTime
- Extend: BloodGroup, Allergies, ChronicConditions, EmergencyContactName/Phone, InsuranceProvider, InsurancePolicyNo, PhotoUrl, IsActive
- Business rule: either ActualDOB or EstimatedDOB must exist; current age is always computed from DOB, never stored as the source of truth.

**Appointments**
- AppointmentID (PK), ClinicID (FK), PatientID (FK), MRNo, AppointmentDate, AppointmentTime, PatientName*, FatherHusbandName*, Gender*, DOB*, CurrentAge*, MobileNo*, DoctorID (FK), VisitType (Deserving/Private — extend with FollowUp/Emergency/Insurance), TokenNo (auto-incrementing per doctor per day), Status (Scheduled/CheckedIn/InConsultation/Completed/Cancelled/NoShow), Remarks, CreatedBy/Date/Time, UpdatedBy/Date/Time
- *Denormalized patient display fields may be served via JOIN rather than duplicated columns — prefer JOINs; keep MRNo for convenience.

**Doctors**
- DoctorID (PK), ClinicID (FK), UserID (FK → Users), DoctorName, Specialization, Status
- Extend: Qualifications, PMDCRegNo/LicenseNo, ConsultationFee, FollowUpFee, RoomNo, Signature/StampUrl

### Additional tables to design and build
- **SubscriptionPlans** (PlanID, Name, PriceMonthly, MaxUsers, MaxPatients, Features JSON) and **ClinicSubscriptions** (history of plan assignments, status, dates)
- **DoctorSchedules** (DoctorID, DayOfWeek, StartTime, EndTime, SlotDurationMinutes, MaxTokens) + **DoctorLeaves**
- **Consultations** (ConsultationID, ClinicID, AppointmentID, PatientID, DoctorID, ChiefComplaint, HistoryOfPresentIllness, ExaminationNotes, Diagnosis, ICD10Code, TreatmentPlan, FollowUpDate, CreatedAt...)
- **Vitals** (VitalID, ClinicID, PatientID, AppointmentID, RecordedByUserID, BP_Systolic, BP_Diastolic, PulseRate, Temperature, Weight, Height, BMI, SpO2, BloodSugar, RecordedAt)
- **Prescriptions** (PrescriptionID, ClinicID, ConsultationID) + **PrescriptionItems** (MedicineName, Dosage, Frequency, DurationDays, Instructions) + optional **Medicines** master list per clinic for autocomplete
- **LabTests** master + **LabOrders** + **LabResults** (with file attachment path)
- **Invoices** (InvoiceID, ClinicID, PatientID, AppointmentID, Items JSON or child table, Subtotal, Discount, Tax, Total, PaidAmount, Status, PaymentMethod) + **Payments**
- **AuditLogs** (LogID, ClinicID, UserID, Action, Entity, EntityID, OldValues JSON, NewValues JSON, IPAddress, Timestamp) — log every create/update/delete and every access to clinical records
- **Notifications** (in-app) and optional SMS/email queue table
- **Documents** (patient file uploads: reports, scans — store path + metadata)

### Database rules
- All migrations are versioned SQL files in `/server/src/db/migrations`, applied by a migration runner script (`npm run db:migrate`). Never modify a previously applied migration; create a new one.
- Seed script creates: default roles, one SUPER_ADMIN (credentials from `.env`), one demo clinic with one user per role and sample patients/appointments for development.
- Use parameterized queries **everywhere** (SQL injection prevention). Never string-concatenate user input into SQL.
- Soft-delete (IsDeleted flag) for Patients, Consultations, Prescriptions; hard delete is not allowed for clinical data.

---

## 4. Feature Set (build all of these)

### Super Admin portal (`/admin`)
1. Dashboard: total clinics, pending approvals, active users, appointments today (aggregate), MRR by plan, growth charts
2. Clinic management: list/search, approve/reject registrations, suspend/reactivate, view clinic profile & subscription
3. Subscription plans CRUD; assign/change clinic plan; expiry handling (grace period → suspend)
4. Platform settings & announcements banner pushed to clinic dashboards
5. System audit view (logins, admin actions — no clinical data)

### Clinic registration & onboarding
1. Public landing page with pricing and "Register your clinic" flow
2. Registration creates clinic in Pending state + Clinic Admin account; email/on-screen confirmation; Super Admin approves
3. First-login onboarding wizard: clinic profile, operating hours, add doctors, fee setup

### Clinic Admin
1. Dashboard: today's appointments, revenue today/this month, new patients, doctor-wise load, charts (Recharts)
2. Staff management: create/invite users, assign roles, reset passwords, deactivate
3. Clinic settings: profile, hours, departments, fee structure, MR No format, token settings, prescription header/footer for printing
4. Reports: appointments by day/doctor/status, revenue reports, patient registration trends, no-show rate; export to CSV/PDF
5. Audit log viewer (their clinic only)

### Reception
1. Patient registration form (all required fields; CNIC format validation; duplicate detection by CNIC/mobile with merge-or-proceed prompt)
2. Patient search: by MR No, name, mobile, CNIC — fast, debounced, keyboard friendly
3. Appointment booking: pick doctor → see available slots from doctor schedule → book; walk-in quick-book issuing next Token No
4. Today's queue board: live list per doctor with statuses; check-in button; drag or click to reorder if allowed
5. Reschedule/cancel with reason; no-show marking
6. Billing: invoice on visit (consultation fee auto-filled from doctor/visit type, Deserving visits can be zero/discounted), record payment, print thermal-friendly receipt
7. Print patient slip / token slip

### Doctor
1. "My day" view: token queue, patient check-in status, start consultation
2. Consultation screen (the core clinical UX):
   - Left: patient summary (demographics, allergies highlighted in red, vitals recorded today, past visits timeline)
   - Right: consultation form (complaint, examination, diagnosis with ICD-10 search, treatment plan)
   - Prescription builder: medicine autocomplete, dosage/frequency/duration chips, common-prescription templates the doctor can save & reuse
   - Order lab tests
   - Finish → generates printable prescription (clinic letterhead, doctor name/signature, Rx layout)
3. Patient medical history: full timeline of consultations, prescriptions, vitals, lab results
4. My schedule management: weekly template + leave days
5. Follow-up scheduling shortcut

### Nurse
1. Today's appointment lookup
2. Vitals entry screen (fast keyboard entry, BMI auto-calc, abnormal values highlighted)
3. Basic history view (allergies, chronic conditions, current meds); restricted consultation-note access per clinic setting

### Cross-cutting features
- Global patient timeline component (role-filtered)
- In-app notifications (appointment booked, patient checked in → doctor, lab result ready)
- Printing: prescription, token slip, invoice/receipt, patient card — clean print CSS or PDF generation
- Full-text patient search scoped to clinic
- Data export (Clinic Admin): patients & appointments CSV
- Optional real-time queue updates via Socket.IO (fallback: polling with TanStack Query refetch)

---

## 5. UI / UX Requirements

The app must be **visually attractive, modern, and animated** — this is a selling point.

- **Design system:** Tailwind CSS with a defined theme (primary medical teal/blue palette, semantic colors for statuses), consistent spacing scale, rounded-xl cards, soft shadows. Build a small component library first: Button, Input, Select, Modal, Drawer, Table, Badge, Tabs, Toast, EmptyState, Skeleton.
- **Animations (Framer Motion):** page transitions, staggered list entrances, modal/drawer spring animations, animated counters on dashboards, hover micro-interactions, animated status badge changes on the queue board. Keep durations 150–300ms; respect `prefers-reduced-motion`.
- **Layouts:** separate role-based layouts with sidebar navigation showing only permitted modules; top bar with clinic name/logo, global patient search (non-admin roles), notifications bell, user menu.
- **Dashboards:** card stats with animated numbers + Recharts charts (area for trends, bar for doctor load, donut for status mix).
- **Forms:** react-hook-form + zod, inline validation, loading states on submit, optimistic UI where safe.
- **States:** every list/table needs loading skeletons, empty states with illustration + CTA, and error states with retry.
- **Responsive:** desktop-first (reception/doctor stations) but fully usable on tablets; queue board readable from a distance (large token numbers).
- **Accessibility:** semantic HTML, focus states, keyboard navigation for reception workflows (they type fast), ARIA on interactive components.
- Dark mode is a nice-to-have; implement only after core features are done.

---

## 6. API Conventions

- Base path `/api/v1`. RESTful modules: `/auth`, `/admin/clinics`, `/admin/plans`, `/users`, `/patients`, `/appointments`, `/consultations`, `/vitals`, `/prescriptions`, `/lab`, `/billing`, `/reports`, `/notifications`.
- Response envelope: `{ success, data, error, meta }`. Pagination: `?page=&limit=` with `meta: { page, limit, total }`.
- Auth: `POST /auth/login` → access token (15 min) + refresh token (httpOnly cookie, 7 days) → `POST /auth/refresh`, `POST /auth/logout`. Rate-limit login attempts; lock account after repeated failures.
- All errors go through a central error handler; never leak stack traces or SQL errors to clients.
- Validate every request body/params/query with zod schemas before hitting services.
- Audit-log middleware records mutating requests and clinical-data reads.

---

## 7. Security & Compliance Rules (non-negotiable)

1. bcrypt (cost ≥ 10) for passwords; JWT secret and DB credentials only from `.env` (provide `.env.example`, never commit `.env`).
2. Tenant isolation enforced in the repository/service layer via authenticated `ClinicID` — never trust client-supplied clinic IDs.
3. Field-level response filtering by role (receptionist never receives clinical fields; super admin never receives clinical rows).
4. Parameterized queries only; helmet + CORS whitelist + rate limiting on the API.
5. Audit log on all clinical data access and all mutations.
6. Input sanitation for file uploads (type/size whitelist), files stored outside web root with tenant-scoped paths.
7. No PHI in logs. No patient data in URLs beyond opaque IDs.

---

## 8. Development Workflow & Quality

- Work feature-by-feature in this order: (1) project scaffolding + DB + migrations + auth/RBAC, (2) Super Admin + clinic registration, (3) Clinic Admin + staff, (4) Patients + Appointments + queue, (5) Vitals + Consultations + Prescriptions, (6) Billing, (7) Reports + notifications, (8) Lab module, (9) polish/animations pass, (10) tests hardening.
- After each module: run the app, verify manually with seeded users of each role, and write/execute the tenant-isolation and RBAC tests for that module before moving on.
- Keep commits small and scoped per module.
- Provide npm scripts: `dev` (concurrently client+server), `db:migrate`, `db:seed`, `test`, `build`.
- Write a `README.md` with setup steps (SQL Server connection config, migrations, seeding, default logins for each role).
- Code style: ESLint + Prettier, no `any` abuse if TypeScript, small components (<200 lines), controllers thin / services fat.

## 9. Definition of Done (per feature)
- [ ] Server-side validation + RBAC + tenant scoping enforced and tested
- [ ] UI has loading/empty/error states and animations
- [ ] Works for the seeded demo users of every relevant role
- [ ] Audit logging in place for mutations/clinical reads
- [ ] No console errors; lint passes
