import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { signAccessToken } from "../src/utils/jwt.js";

const app = createApp();
const RUN = Date.now().toString(36);

interface Ctx {
  clinicId: string;
  doctorId: string;
  patientId: string;
  appointmentId: string;
  adminToken: string;
  doctorToken: string;
  nurseToken: string;
  receptionToken: string;
}

async function makeClinic(label: string): Promise<Ctx> {
  const pool = await getPool();
  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `P5 ${label} ${RUN}`)
    .query<{ ClinicID: string }>(`INSERT INTO Clinics (ClinicName, Status) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved')`);
  const clinicId = clinic.recordset[0].ClinicID;

  async function user(role: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, `p5.${role}.${label}.${RUN}`)
      .input("role", sql.NVarChar, role)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (@clinicId, @username, 'x', @role, @role)`,
      );
    return r.recordset[0].UserID;
  }

  const adminId = await user("CLINIC_ADMIN");
  const docUserId = await user("DOCTOR");
  const nurseId = await user("NURSE");
  const recId = await user("RECEPTIONIST");

  const doc = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, docUserId)
    .query<{ DoctorID: string }>(`INSERT INTO Doctors (ClinicID, UserID, DoctorName) OUTPUT INSERTED.DoctorID VALUES (@clinicId, @userId, 'Dr P5')`);
  const doctorId = doc.recordset[0].DoctorID;

  const pat = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("mr", sql.NVarChar, `MR-P5-${label}-${RUN}`)
    .query<{ PatientID: string }>(
      `INSERT INTO Patients (ClinicID, MRNo, PatientName, Gender, ActualDOB, Allergies) OUTPUT INSERTED.PatientID VALUES (@clinicId, @mr, 'Pat P5', 'Male', '1990-01-01', 'Penicillin')`,
    );
  const patientId = pat.recordset[0].PatientID;

  const appt = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<{ AppointmentID: string }>(
      `INSERT INTO Appointments (ClinicID, PatientID, DoctorID, AppointmentDate, AppointmentTime, TokenNo) OUTPUT INSERTED.AppointmentID VALUES (@clinicId, @patientId, @doctorId, CAST(SYSUTCDATETIME() AS DATE), '09:00', 1)`,
    );

  return {
    clinicId,
    doctorId,
    patientId,
    appointmentId: appt.recordset[0].AppointmentID,
    adminToken: signAccessToken({ sub: adminId, username: "a", role: "CLINIC_ADMIN", clinicId }),
    doctorToken: signAccessToken({ sub: docUserId, username: "d", role: "DOCTOR", clinicId }),
    nurseToken: signAccessToken({ sub: nurseId, username: "n", role: "NURSE", clinicId }),
    receptionToken: signAccessToken({ sub: recId, username: "r", role: "RECEPTIONIST", clinicId }),
  };
}

let A: Ctx;

beforeAll(async () => {
  await runMigrations();
  A = await makeClinic("A");
});

afterAll(async () => {
  const pool = await getPool();
  await pool.request().input("id", sql.UniqueIdentifier, A.clinicId).query(`
    DELETE FROM PrescriptionItems WHERE PrescriptionID IN (SELECT PrescriptionID FROM Prescriptions WHERE ClinicID = @id);
    DELETE FROM Prescriptions WHERE ClinicID = @id;
    DELETE FROM PrescriptionTemplates WHERE ClinicID = @id;
    DELETE FROM Vitals WHERE ClinicID = @id;
    DELETE FROM AuditLogs WHERE ClinicID = @id;
    DELETE FROM Consultations WHERE ClinicID = @id;
    DELETE FROM DoctorLeaves WHERE ClinicID = @id;
    DELETE FROM Appointments WHERE ClinicID = @id;
    DELETE FROM Doctors WHERE ClinicID = @id;
    DELETE FROM Patients WHERE ClinicID = @id;
    DELETE FROM Users WHERE ClinicID = @id;
    DELETE FROM Clinics WHERE ClinicID = @id;
  `);
  await closePool();
});

describe("Phase 5 — vitals", () => {
  it("records vitals with server-computed BMI, blocking receptionists", async () => {
    const nurse = await request(app)
      .post("/api/v1/vitals")
      .set("Authorization", `Bearer ${A.nurseToken}`)
      .send({ patientId: A.patientId, weight: 80, height: 175, bpSystolic: 120, bpDiastolic: 80 });
    expect(nurse.status).toBe(201);
    expect(nurse.body.data.bmi).toBeCloseTo(26.1, 1);

    const rec = await request(app)
      .post("/api/v1/vitals")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId: A.patientId, weight: 70 });
    expect(rec.status).toBe(403);
  });
});

describe("Phase 5 — consultations RBAC", () => {
  let consultationId: string;

  it("lets a doctor create a consultation but blocks a nurse from writing (403)", async () => {
    const doc = await request(app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ appointmentId: A.appointmentId, chiefComplaint: "Fever", examinationNotes: "Throat red", diagnosis: "URTI", treatmentPlan: "Rest" });
    expect(doc.status).toBe(201);
    consultationId = doc.body.data.ConsultationID;

    const nurse = await request(app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${A.nurseToken}`)
      .send({ appointmentId: A.appointmentId, diagnosis: "x" });
    expect(nurse.status).toBe(403);
  });

  it("gives a nurse a summary-only view (no examination notes / treatment plan)", async () => {
    const res = await request(app).get(`/api/v1/consultations/${consultationId}`).set("Authorization", `Bearer ${A.nurseToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.Diagnosis).toBe("URTI");
    expect(res.body.data.ExaminationNotes).toBeUndefined();
    expect(res.body.data.TreatmentPlan).toBeUndefined();
  });

  it("blocks a receptionist from consultation notes (403)", async () => {
    const res = await request(app).get(`/api/v1/consultations/${consultationId}`).set("Authorization", `Bearer ${A.receptionToken}`);
    expect(res.status).toBe(403);
  });
});

describe("Phase 5 — prescriptions & templates", () => {
  let consultationId: string;

  beforeAll(async () => {
    const doc = await request(app)
      .post("/api/v1/consultations")
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ appointmentId: A.appointmentId, diagnosis: "Rx test" });
    consultationId = doc.body.data.ConsultationID;
  });

  it("saves a prescription and reads it back", async () => {
    const save = await request(app)
      .post("/api/v1/prescriptions")
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ consultationId, items: [{ medicineName: "Paracetamol 500mg", dosage: "1 tab", frequency: "TID", durationDays: 5 }] });
    expect(save.status).toBe(201);
    expect(save.body.data.items).toHaveLength(1);

    const read = await request(app).get(`/api/v1/prescriptions?consultationId=${consultationId}`).set("Authorization", `Bearer ${A.doctorToken}`);
    expect(read.body.data.items[0].medicineName).toBe("Paracetamol 500mg");
  });

  it("blocks a nurse from writing a prescription (403)", async () => {
    const res = await request(app)
      .post("/api/v1/prescriptions")
      .set("Authorization", `Bearer ${A.nurseToken}`)
      .send({ consultationId, items: [] });
    expect(res.status).toBe(403);
  });

  it("saves and lists per-doctor prescription templates", async () => {
    await request(app)
      .post("/api/v1/prescriptions/templates")
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ name: "Combo", items: [{ medicineName: "Amoxicillin", dosage: "500mg", frequency: "BID", durationDays: 7 }] });
    const list = await request(app).get("/api/v1/prescriptions/templates").set("Authorization", `Bearer ${A.doctorToken}`);
    expect(list.body.data.some((t: { name: string }) => t.name === "Combo")).toBe(true);
  });
});

describe("Phase 5 — patient history & doctor schedule", () => {
  it("returns a role-filtered patient history for a doctor", async () => {
    const res = await request(app).get(`/api/v1/patients/${A.patientId}/history`).set("Authorization", `Bearer ${A.doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.patient.allergies).toBe("Penicillin");
    expect(Array.isArray(res.body.data.vitals)).toBe(true);
  });

  it("blocks a receptionist from patient history (403)", async () => {
    const res = await request(app).get(`/api/v1/patients/${A.patientId}/history`).set("Authorization", `Bearer ${A.receptionToken}`);
    expect(res.status).toBe(403);
  });

  it("lets a doctor set their own leave", async () => {
    const res = await request(app)
      .post(`/api/v1/doctors/${A.doctorId}/leaves`)
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ leaveDate: "2026-09-01", reason: "Leave" });
    expect(res.status).toBe(201);
  });
});
