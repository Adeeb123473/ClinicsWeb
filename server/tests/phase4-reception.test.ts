import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { createFullFeaturePlan } from "./helpers/testPlan.js";

const app = createApp();
const RUN = Date.now().toString(36);

interface Ctx {
  clinicId: string;
  planId: string;
  doctorId: string;
  adminToken: string;
  receptionToken: string;
  doctorToken: string;
  nurseToken: string;
}

async function makeClinic(label: string): Promise<Ctx> {
  const pool = await getPool();
  const planId = await createFullFeaturePlan(pool, `p4-${label}-${RUN}`);
  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `P4 ${label} ${RUN}`)
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ ClinicID: string }>(`INSERT INTO Clinics (ClinicName, Status, SubscriptionPlanID) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved', @planId)`);
  const clinicId = clinic.recordset[0].ClinicID;

  async function user(role: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, `p4.${role}.${label}.${RUN}`)
      .input("role", sql.NVarChar, role)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (@clinicId, @username, 'x', @role, @role)`,
      );
    return r.recordset[0].UserID;
  }

  const adminId = await user("CLINIC_ADMIN");
  const recId = await user("RECEPTIONIST");
  const docUserId = await user("DOCTOR");
  const nurseId = await user("NURSE");

  const doc = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, docUserId)
    .query<{ DoctorID: string }>(
      `INSERT INTO Doctors (ClinicID, UserID, DoctorName, ConsultationFee) OUTPUT INSERTED.DoctorID VALUES (@clinicId, @userId, 'Dr Test', 1000)`,
    );

  return {
    clinicId,
    planId,
    doctorId: doc.recordset[0].DoctorID,
    adminToken: signAccessToken({ sub: adminId, username: "a", role: "CLINIC_ADMIN", clinicId }),
    receptionToken: signAccessToken({ sub: recId, username: "r", role: "RECEPTIONIST", clinicId }),
    doctorToken: signAccessToken({ sub: docUserId, username: "d", role: "DOCTOR", clinicId }),
    nurseToken: signAccessToken({ sub: nurseId, username: "n", role: "NURSE", clinicId }),
  };
}

let A: Ctx;
let B: Ctx;
const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await runMigrations();
  A = await makeClinic("A");
  B = await makeClinic("B");
});

afterAll(async () => {
  const pool = await getPool();
  for (const ctx of [A, B]) {
    await pool.request().input("id", sql.UniqueIdentifier, ctx.clinicId).query(`
      DELETE FROM Payments WHERE ClinicID = @id;
      DELETE FROM InvoiceItems WHERE InvoiceID IN (SELECT InvoiceID FROM Invoices WHERE ClinicID = @id);
      DELETE FROM Invoices WHERE ClinicID = @id;
      DELETE FROM AuditLogs WHERE ClinicID = @id;
      DELETE FROM Appointments WHERE ClinicID = @id;
      DELETE FROM Doctors WHERE ClinicID = @id;
      DELETE FROM Patients WHERE ClinicID = @id;
      DELETE FROM Users WHERE ClinicID = @id;
      DELETE FROM Clinics WHERE ClinicID = @id;
    `);
    await pool.request().input("planId", sql.UniqueIdentifier, ctx.planId).query(`DELETE FROM SubscriptionPlans WHERE PlanID = @planId`);
  }
  await closePool();
});

async function registerPatient(ctx: Ctx, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/v1/patients")
    .set("Authorization", `Bearer ${ctx.receptionToken}`)
    .send({ patientName: "Reg Patient", gender: "Male", actualDOB: "1990-01-01", category: "General", ...overrides });
}

describe("Phase 4 — patient registration & search", () => {
  it("registers a patient with an auto-generated MR number and computed age", async () => {
    const res = await registerPatient(A, { mobileNo: `0300${Date.now() % 10000000}` });
    expect(res.status).toBe(201);
    expect(res.body.data.MRNo).toMatch(/MR-\d{4}-\d{4}/);
    expect(res.body.data.currentAge.unit).toBe("Years");
  });

  it("allows the same CNIC to be registered for multiple patients", async () => {
    const cnic = "35202-9999999-1";
    const first = await registerPatient(A, { cnic });
    expect(first.status).toBe(201);

    const second = await registerPatient(A, { cnic });
    expect(second.status).toBe(201);
    expect(second.body.data.PatientID).not.toBe(first.body.data.PatientID);
  });

  it("detects duplicate mobile number and blocks with 409, unless forced", async () => {
    const mobileNo = `0301${Date.now() % 10000000}`;
    const first = await registerPatient(A, { mobileNo });
    expect(first.status).toBe(201);

    const dup = await registerPatient(A, { mobileNo });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("DUPLICATE_PATIENT");

    const forced = await registerPatient(A, { mobileNo, forceDuplicate: true });
    expect(forced.status).toBe(201);
  });

  it("omits clinical fields for a receptionist searching patients", async () => {
    await registerPatient(A, { allergies: "Penicillin", chronicConditions: "Diabetes", bloodGroup: "O+" });
    const res = await request(app).get("/api/v1/patients?q=Reg").set("Authorization", `Bearer ${A.receptionToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].Allergies).toBeUndefined();
    expect(res.body.data[0].ChronicConditions).toBeUndefined();
  });

  it("blocks a NURSE from registering patients (403)", async () => {
    const res = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${A.nurseToken}`)
      .send({ patientName: "X", gender: "Male", actualDOB: "1990-01-01", category: "General" });
    expect(res.status).toBe(403);
  });

  it("requires a DOB (either actual or estimated) — 400", async () => {
    const res = await request(app)
      .post("/api/v1/patients")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientName: "No DOB", gender: "Male", category: "General" });
    expect(res.status).toBe(400);
  });

  it("rejects a mobile number that isn't digits-only or is over 11 digits (400)", async () => {
    const letters = await registerPatient(A, { mobileNo: "0300abc4567" });
    expect(letters.status).toBe(400);

    const tooLong = await registerPatient(A, { mobileNo: "030012345678" });
    expect(tooLong.status).toBe(400);

    const ok = await registerPatient(A, { mobileNo: "03001234567" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.MobileNo).toBe("03001234567");
  });

  it("rejects a malformed CNIC (400)", async () => {
    const res = await registerPatient(A, { cnic: "352029999991" });
    expect(res.status).toBe(400);
  });
});

describe("Phase 4 — appointments & queue", () => {
  let patientId: string;

  it("books a walk-in and issues sequential tokens", async () => {
    const p = await registerPatient(A, { mobileNo: `0311${Date.now() % 10000000}` });
    patientId = p.body.data.PatientID;

    const first = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, doctorId: A.doctorId, date: today, visitType: "Private" });
    expect(first.status).toBe(201);
    const t1 = first.body.data.tokenNo;

    const second = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, doctorId: A.doctorId, date: today, visitType: "FollowUp" });
    expect(second.body.data.tokenNo).toBe(t1 + 1);
  });

  it("lets reception override the consultation fee for a booking, defaulting to null when omitted", async () => {
    const overridden = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, doctorId: A.doctorId, date: today, visitType: "Deserving", consultationFee: 0 });
    expect(overridden.status).toBe(201);
    expect(overridden.body.data.consultationFee).toBe(0);

    const withoutOverride = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, doctorId: A.doctorId, date: today, visitType: "Private" });
    expect(withoutOverride.status).toBe(201);
    expect(withoutOverride.body.data.consultationFee).toBeNull();
  });

  it("returns 404 when booking with another clinic's doctor (tenant isolation)", async () => {
    const res = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, doctorId: B.doctorId, date: today, visitType: "Private" });
    expect(res.status).toBe(404);
  });

  it("enforces valid status transitions (Scheduled → Completed is rejected 400)", async () => {
    const appt = await request(app)
      .post("/api/v1/appointments")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, doctorId: A.doctorId, date: today, visitType: "Private" });
    const id = appt.body.data.appointmentId;

    const bad = await request(app)
      .patch(`/api/v1/appointments/${id}/status`)
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ status: "Completed" });
    expect(bad.status).toBe(400);

    const good = await request(app)
      .patch(`/api/v1/appointments/${id}/status`)
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ status: "CheckedIn" });
    expect(good.status).toBe(200);
    expect(good.body.data.status).toBe("CheckedIn");
  });
});

describe("Phase 4 — billing", () => {
  let patientId: string;

  it("creates an invoice and records a payment, deriving Paid status", async () => {
    const p = await registerPatient(A, { mobileNo: `0322${Date.now() % 10000000}` });
    patientId = p.body.data.PatientID;

    const inv = await request(app)
      .post("/api/v1/billing/invoices")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId, items: [{ description: "Consultation", quantity: 1, unitPrice: 1000 }] });
    expect(inv.status).toBe(201);
    expect(inv.body.data.total).toBe(1000);
    const invoiceId = inv.body.data.invoiceId;

    const overpay = await request(app)
      .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ amount: 5000, method: "Cash" });
    expect(overpay.status).toBe(400);

    const pay = await request(app)
      .post(`/api/v1/billing/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ amount: 1000, method: "Cash" });
    expect(pay.status).toBe(200);
    expect(pay.body.data.status).toBe("Paid");
  });

  it("blocks a DOCTOR from billing (403)", async () => {
    const res = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${A.doctorToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks a NURSE from billing (403)", async () => {
    const res = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${A.nurseToken}`);
    expect(res.status).toBe(403);
  });
});
