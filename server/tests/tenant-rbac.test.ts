import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { hashPassword } from "../src/utils/password.js";
import { signAccessToken } from "../src/utils/jwt.js";

const app = createApp();

interface Fixture {
  clinicId: string;
  patientId: string;
  consultationId: string;
  tokens: {
    clinicAdmin: string;
    doctor: string;
    receptionist: string;
    nurse: string;
  };
  userIds: {
    doctor: string;
  };
}

let clinicA: Fixture;
let clinicB: Fixture;
let superAdminToken: string;

const RUN_ID = Date.now().toString(36);

async function createClinicFixture(label: string): Promise<Fixture> {
  const pool = await getPool();

  const clinicResult = await pool
    .request()
    .input("name", sql.NVarChar, `Test Clinic ${label} ${RUN_ID}`)
    .query<{ ClinicID: string }>(
      `INSERT INTO Clinics (ClinicName, Status) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved')`,
    );
  const clinicId = clinicResult.recordset[0].ClinicID;

  const passwordHash = await hashPassword("Passw0rd!TestOnly");

  async function insertUser(role: string, username: string): Promise<string> {
    const result = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, username)
      .input("passwordHash", sql.NVarChar, passwordHash)
      .input("role", sql.NVarChar, role)
      .input("fullName", sql.NVarChar, `${role} ${label}`)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName)
         OUTPUT INSERTED.UserID
         VALUES (@clinicId, @username, @passwordHash, @role, @fullName)`,
      );
    return result.recordset[0].UserID;
  }

  const clinicAdminUserId = await insertUser("CLINIC_ADMIN", `clinicadmin.${label}.${RUN_ID}`);
  const doctorUserId = await insertUser("DOCTOR", `doctor.${label}.${RUN_ID}`);
  const receptionistUserId = await insertUser("RECEPTIONIST", `receptionist.${label}.${RUN_ID}`);
  const nurseUserId = await insertUser("NURSE", `nurse.${label}.${RUN_ID}`);

  const doctorResult = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, doctorUserId)
    .input("doctorName", sql.NVarChar, `Dr. ${label}`)
    .query<{ DoctorID: string }>(
      `INSERT INTO Doctors (ClinicID, UserID, DoctorName) OUTPUT INSERTED.DoctorID VALUES (@clinicId, @userId, @doctorName)`,
    );
  const doctorId = doctorResult.recordset[0].DoctorID;

  const patientResult = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("mrNo", sql.NVarChar, `MR-${label}-${RUN_ID}`)
    .input("name", sql.NVarChar, `Patient ${label}`)
    .query<{ PatientID: string }>(
      `INSERT INTO Patients (ClinicID, MRNo, PatientName, Gender, ActualDOB, Allergies, ChronicConditions, BloodGroup)
       OUTPUT INSERTED.PatientID
       VALUES (@clinicId, @mrNo, @name, 'Male', '1990-01-01', 'Penicillin', 'Hypertension', 'O+')`,
    );
  const patientId = patientResult.recordset[0].PatientID;

  const appointmentResult = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<{ AppointmentID: string }>(
      `INSERT INTO Appointments (ClinicID, PatientID, DoctorID, AppointmentDate, AppointmentTime, TokenNo)
       OUTPUT INSERTED.AppointmentID
       VALUES (@clinicId, @patientId, @doctorId, CAST(SYSUTCDATETIME() AS DATE), '09:00', 1)`,
    );
  const appointmentId = appointmentResult.recordset[0].AppointmentID;

  const consultationResult = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("appointmentId", sql.UniqueIdentifier, appointmentId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .input("doctorId", sql.UniqueIdentifier, doctorId)
    .query<{ ConsultationID: string }>(
      `INSERT INTO Consultations (ClinicID, AppointmentID, PatientID, DoctorID, ChiefComplaint, ExaminationNotes, Diagnosis, TreatmentPlan)
       OUTPUT INSERTED.ConsultationID
       VALUES (@clinicId, @appointmentId, @patientId, @doctorId, 'Fever', 'Detailed exam notes', 'Viral infection', 'Rest and fluids')`,
    );
  const consultationId = consultationResult.recordset[0].ConsultationID;

  return {
    clinicId,
    patientId,
    consultationId,
    userIds: { doctor: doctorUserId },
    tokens: {
      clinicAdmin: signAccessToken({ sub: clinicAdminUserId, username: "x", role: "CLINIC_ADMIN", clinicId }),
      doctor: signAccessToken({ sub: doctorUserId, username: "x", role: "DOCTOR", clinicId }),
      receptionist: signAccessToken({ sub: receptionistUserId, username: "x", role: "RECEPTIONIST", clinicId }),
      nurse: signAccessToken({ sub: nurseUserId, username: "x", role: "NURSE", clinicId }),
    },
  };
}

beforeAll(async () => {
  await runMigrations();
  clinicA = await createClinicFixture("A");
  clinicB = await createClinicFixture("B");
  superAdminToken = signAccessToken({ sub: "00000000-0000-0000-0000-000000000000", username: "super", role: "SUPER_ADMIN", clinicId: null });
});

afterAll(async () => {
  const pool = await getPool();
  for (const fixture of [clinicA, clinicB]) {
    await pool.request().input("id", sql.UniqueIdentifier, fixture.clinicId).query(`
      DELETE FROM AuditLogs WHERE ClinicID = @id;
      DELETE FROM Consultations WHERE ClinicID = @id;
      DELETE FROM Appointments WHERE ClinicID = @id;
      DELETE FROM Doctors WHERE ClinicID = @id;
      DELETE FROM Patients WHERE ClinicID = @id;
      DELETE FROM Users WHERE ClinicID = @id;
      DELETE FROM Clinics WHERE ClinicID = @id;
    `);
  }
  await closePool();
});

describe("authentication", () => {
  it("rejects requests with no Authorization header", async () => {
    const res = await request(app).get(`/api/v1/patients/${clinicA.patientId}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects requests with a malformed token", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${clinicA.patientId}`)
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("RBAC: consultation notes", () => {
  it("blocks a receptionist from reading consultation notes (403)", async () => {
    const res = await request(app)
      .get(`/api/v1/consultations/${clinicA.consultationId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.receptionist}`);
    expect(res.status).toBe(403);
  });

  it("blocks super admin from reading any clinical data (403)", async () => {
    const res = await request(app)
      .get(`/api/v1/consultations/${clinicA.consultationId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks super admin from reading patient records (403)", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${clinicA.patientId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(403);
  });

  it("allows a doctor to read the full consultation record", async () => {
    const res = await request(app)
      .get(`/api/v1/consultations/${clinicA.consultationId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.doctor}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ExaminationNotes).toBe("Detailed exam notes");
    expect(res.body.data.TreatmentPlan).toBe("Rest and fluids");
  });

  it("gives a nurse only a summary view of the consultation", async () => {
    const res = await request(app)
      .get(`/api/v1/consultations/${clinicA.consultationId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.nurse}`);
    expect(res.status).toBe(200);
    expect(res.body.data.Diagnosis).toBe("Viral infection");
    expect(res.body.data.ExaminationNotes).toBeUndefined();
    expect(res.body.data.TreatmentPlan).toBeUndefined();
  });
});

describe("RBAC: patient field filtering", () => {
  it("omits clinical fields (allergies, chronic conditions) for a receptionist", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${clinicA.patientId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.receptionist}`);
    expect(res.status).toBe(200);
    expect(res.body.data.Allergies).toBeUndefined();
    expect(res.body.data.ChronicConditions).toBeUndefined();
    expect(res.body.data.PatientName).toBeDefined();
  });

  it("includes clinical fields for a doctor", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${clinicA.patientId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.doctor}`);
    expect(res.status).toBe(200);
    expect(res.body.data.Allergies).toBe("Penicillin");
  });
});

describe("tenant isolation", () => {
  it("returns 404 (not 403) when a doctor from clinic A requests a patient from clinic B", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${clinicB.patientId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.doctor}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when a doctor from clinic A requests a consultation from clinic B", async () => {
    const res = await request(app)
      .get(`/api/v1/consultations/${clinicB.consultationId}`)
      .set("Authorization", `Bearer ${clinicA.tokens.doctor}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a well-formed but nonexistent patient id within the caller's own clinic", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/00000000-0000-0000-0000-000000000000`)
      .set("Authorization", `Bearer ${clinicA.tokens.doctor}`);
    expect(res.status).toBe(404);
  });
});

describe("login flow", () => {
  it("logs in with seeded credentials and returns an access token + user, rejecting bad passwords", async () => {
    const pool = await getPool();
    const username = `login.test.${RUN_ID}`;
    const passwordHash = await hashPassword("CorrectHorse123!");
    await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicA.clinicId)
      .input("username", sql.NVarChar, username)
      .input("passwordHash", sql.NVarChar, passwordHash)
      .query(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) VALUES (@clinicId, @username, @passwordHash, 'RECEPTIONIST', 'Login Test')`,
      );

    const good = await request(app).post("/api/v1/auth/login").send({ username, password: "CorrectHorse123!" });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTypeOf("string");
    expect(good.body.data.user.role).toBe("RECEPTIONIST");
    expect(good.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);

    const bad = await request(app).post("/api/v1/auth/login").send({ username, password: "wrong" });
    expect(bad.status).toBe(401);

    await pool.request().input("username", sql.NVarChar, username).query(`
      DELETE FROM AuditLogs WHERE UserID IN (SELECT UserID FROM Users WHERE Username = @username);
      DELETE FROM Users WHERE Username = @username;
    `);
  });

  it("rejects a login request with a missing password", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ username: "someone" });
    expect(res.status).toBe(400);
  });
});
