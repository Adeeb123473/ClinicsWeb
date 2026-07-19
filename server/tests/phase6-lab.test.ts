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
  patientId: string;
  doctorToken: string;
  nurseToken: string;
  receptionToken: string;
}

async function makeClinic(label: string): Promise<Ctx> {
  const pool = await getPool();
  const planId = await createFullFeaturePlan(pool, `p6-${label}-${RUN}`);
  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `P6 ${label} ${RUN}`)
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ ClinicID: string }>(`INSERT INTO Clinics (ClinicName, Status, SubscriptionPlanID) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved', @planId)`);
  const clinicId = clinic.recordset[0].ClinicID;

  async function user(role: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, `p6.${role}.${label}.${RUN}`)
      .input("role", sql.NVarChar, role)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (@clinicId, @username, 'x', @role, @role)`,
      );
    return r.recordset[0].UserID;
  }

  const docUserId = await user("DOCTOR");
  const nurseId = await user("NURSE");
  const recId = await user("RECEPTIONIST");

  const doc = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("userId", sql.UniqueIdentifier, docUserId)
    .query<{ DoctorID: string }>(`INSERT INTO Doctors (ClinicID, UserID, DoctorName) OUTPUT INSERTED.DoctorID VALUES (@clinicId, @userId, 'Dr P6')`);
  const doctorId = doc.recordset[0].DoctorID;

  const pat = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("mr", sql.NVarChar, `MR-P6-${label}-${RUN}`)
    .query<{ PatientID: string }>(`INSERT INTO Patients (ClinicID, MRNo, PatientName, Gender, ActualDOB) OUTPUT INSERTED.PatientID VALUES (@clinicId, @mr, 'Pat P6', 'Male', '1990-01-01')`);

  return {
    clinicId,
    planId,
    doctorId,
    patientId: pat.recordset[0].PatientID,
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
    DELETE FROM LabResults WHERE LabOrderID IN (SELECT LabOrderID FROM LabOrders WHERE ClinicID = @id);
    DELETE FROM LabOrders WHERE ClinicID = @id;
    DELETE FROM LabTests WHERE ClinicID = @id;
    DELETE FROM AuditLogs WHERE ClinicID = @id;
    DELETE FROM Appointments WHERE ClinicID = @id;
    DELETE FROM Doctors WHERE ClinicID = @id;
    DELETE FROM Patients WHERE ClinicID = @id;
    DELETE FROM Users WHERE ClinicID = @id;
    DELETE FROM Clinics WHERE ClinicID = @id;
  `);
  await pool.request().input("planId", sql.UniqueIdentifier, A.planId).query(`DELETE FROM SubscriptionPlans WHERE PlanID = @planId`);
  await closePool();
});

describe("Phase 6 — lab workflow", () => {
  let testId: string;
  let orderId: string;

  it("lets a doctor create a lab test and order it", async () => {
    const test = await request(app)
      .post("/api/v1/lab/tests")
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ name: "CBC", category: "Hematology", price: 800 });
    expect(test.status).toBe(201);
    testId = test.body.data.labTestId;

    const order = await request(app)
      .post("/api/v1/lab/orders")
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ patientId: A.patientId, labTestId: testId });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe("Ordered");
    orderId = order.body.data.labOrderId;
  });

  it("blocks a receptionist from ordering labs (403)", async () => {
    const res = await request(app)
      .post("/api/v1/lab/orders")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ patientId: A.patientId, labTestId: testId });
    expect(res.status).toBe(403);
  });

  it("records a result and marks the order Completed", async () => {
    const result = await request(app)
      .post(`/api/v1/lab/orders/${orderId}/result`)
      .set("Authorization", `Bearer ${A.nurseToken}`)
      .send({ resultText: "Hb 13.5, WBC 7000 — normal" });
    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe("Completed");
  });

  it("blocks a receptionist from lab orders list (403)", async () => {
    const res = await request(app).get("/api/v1/lab/orders").set("Authorization", `Bearer ${A.receptionToken}`);
    expect(res.status).toBe(403);
  });
});
