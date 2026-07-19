import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { signAccessToken } from "../src/utils/jwt.js";

const app = createApp();
const RUN = Date.now().toString(36);

let superAdminToken: string;
let clinicAdminToken: string;
let clinicId: string;
let clinicAdminUserId: string;
const createdUsernames: string[] = [];
const createdPlanIds: string[] = [];
const createdClinicIds: string[] = [];

beforeAll(async () => {
  await runMigrations();
  const pool = await getPool();

  const clinicResult = await pool
    .request()
    .input("name", sql.NVarChar, `P2 Clinic ${RUN}`)
    .query<{ ClinicID: string }>(
      `INSERT INTO Clinics (ClinicName, Status) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved')`,
    );
  clinicId = clinicResult.recordset[0].ClinicID;
  createdClinicIds.push(clinicId);

  const userResult = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("username", sql.NVarChar, `p2.admin.${RUN}`)
    .input("hash", sql.NVarChar, "x")
    .query<{ UserID: string }>(
      `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName)
       OUTPUT INSERTED.UserID VALUES (@clinicId, @username, @hash, 'CLINIC_ADMIN', 'P2 Admin')`,
    );
  clinicAdminUserId = userResult.recordset[0].UserID;
  createdUsernames.push(`p2.admin.${RUN}`);

  superAdminToken = signAccessToken({
    sub: "00000000-0000-0000-0000-000000000000",
    username: "super",
    role: "SUPER_ADMIN",
    clinicId: null,
  });
  clinicAdminToken = signAccessToken({
    sub: clinicAdminUserId,
    username: "p2admin",
    role: "CLINIC_ADMIN",
    clinicId,
  });
});

afterAll(async () => {
  const pool = await getPool();
  for (const id of createdPlanIds) {
    await pool.request().input("id", sql.UniqueIdentifier, id).query(`DELETE FROM SubscriptionPlans WHERE PlanID = @id`);
  }
  for (const id of createdClinicIds) {
    await pool.request().input("id", sql.UniqueIdentifier, id).query(`
      DELETE FROM AuditLogs WHERE ClinicID = @id;
      DELETE FROM ClinicSubscriptions WHERE ClinicID = @id;
      DELETE FROM Users WHERE ClinicID = @id;
      DELETE FROM Clinics WHERE ClinicID = @id;
    `);
  }
  await closePool();
});

describe("Phase 2 — RBAC on admin endpoints", () => {
  it("lets SUPER_ADMIN read the platform dashboard (aggregate only)", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totals.totalClinics).toBeGreaterThanOrEqual(1);
    // Privacy boundary: the aggregate payload must not carry any patient/clinical rows.
    expect(JSON.stringify(res.body.data)).not.toMatch(/PatientName|Diagnosis|Allergies/i);
  });

  it("blocks a CLINIC_ADMIN from the platform dashboard (403)", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${clinicAdminToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks a CLINIC_ADMIN from listing all clinics (403)", async () => {
    const res = await request(app).get("/api/v1/admin/clinics").set("Authorization", `Bearer ${clinicAdminToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks a CLINIC_ADMIN from managing plans (403)", async () => {
    const res = await request(app)
      .post("/api/v1/admin/plans")
      .set("Authorization", `Bearer ${clinicAdminToken}`)
      .send({ name: "Hack", priceMonthly: 1 });
    expect(res.status).toBe(403);
  });

  it("requires authentication for admin endpoints (401)", async () => {
    const res = await request(app).get("/api/v1/admin/clinics");
    expect(res.status).toBe(401);
  });
});

describe("Phase 2 — Subscription plans CRUD", () => {
  it("creates, reads, updates and deletes a plan as SUPER_ADMIN", async () => {
    const create = await request(app)
      .post("/api/v1/admin/plans")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ name: `Test Plan ${RUN}`, priceMonthly: 49.5, maxUsers: 10, features: ["appointments"] });
    expect(create.status).toBe(201);
    const planId = create.body.data.planId;
    createdPlanIds.push(planId);
    expect(create.body.data.features).toEqual(["appointments"]);

    const update = await request(app)
      .put(`/api/v1/admin/plans/${planId}`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ name: `Test Plan ${RUN}`, priceMonthly: 59, maxUsers: 20, features: ["appointments", "billing"] });
    expect(update.status).toBe(200);
    expect(update.body.data.priceMonthly).toBe(59);

    const del = await request(app)
      .delete(`/api/v1/admin/plans/${planId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(del.status).toBe(200);
  });

  it("refuses to delete a plan still assigned to a clinic (409)", async () => {
    const create = await request(app)
      .post("/api/v1/admin/plans")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ name: `In-Use Plan ${RUN}`, priceMonthly: 10 });
    const planId = create.body.data.planId;
    createdPlanIds.push(planId);

    await request(app)
      .post(`/api/v1/admin/clinics/${clinicId}/plan`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ planId });

    const del = await request(app)
      .delete(`/api/v1/admin/plans/${planId}`)
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(del.status).toBe(409);

    // detach so afterAll can clean the plan up
    const pool = await getPool();
    await pool.request().input("id", sql.UniqueIdentifier, clinicId).query(
      `UPDATE Clinics SET SubscriptionPlanID = NULL WHERE ClinicID = @id; DELETE FROM ClinicSubscriptions WHERE ClinicID = @id;`,
    );
  });

  it("exposes only active plans on the public pricing endpoint (no auth)", async () => {
    const res = await request(app).get("/api/v1/admin/plans/public");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.every((p: { isActive: boolean }) => p.isActive)).toBe(true);
  });
});

describe("Phase 2 — Clinic registration + approval", () => {
  it("registers a new clinic in Pending status and can then be approved", async () => {
    const username = `reg.${RUN}`;
    createdUsernames.push(username);
    const reg = await request(app).post("/api/v1/auth/register-clinic").send({
      clinicName: `Registered Clinic ${RUN}`,
      clinicEmail: `clinic.${RUN}@example.com`,
      adminFullName: "New Admin",
      adminUsername: username,
      adminEmail: `admin.${RUN}@example.com`,
      password: "Passw0rdReg",
    });
    expect(reg.status).toBe(201);
    expect(reg.body.data.status).toBe("Pending");
    const newClinicId = reg.body.data.clinicId;
    createdClinicIds.push(newClinicId);

    const list = await request(app)
      .get("/api/v1/admin/clinics?status=Pending")
      .set("Authorization", `Bearer ${superAdminToken}`);
    expect(list.body.data.some((c: { clinicId: string }) => c.clinicId === newClinicId)).toBe(true);

    const approve = await request(app)
      .post(`/api/v1/admin/clinics/${newClinicId}/actions`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ action: "approve" });
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe("Approved");
  });

  it("blocks login for a Pending clinic's admin, then allows it once approved, then blocks it again once suspended", async () => {
    const username = `gate.${RUN}`;
    const password = "Passw0rdGate1";
    createdUsernames.push(username);

    const reg = await request(app).post("/api/v1/auth/register-clinic").send({
      clinicName: `Gate Clinic ${RUN}`,
      clinicEmail: `gate.${RUN}@example.com`,
      adminFullName: "Gate Admin",
      adminUsername: username,
      adminEmail: `gateadmin.${RUN}@example.com`,
      password,
    });
    expect(reg.status).toBe(201);
    const clinicId = reg.body.data.clinicId;
    createdClinicIds.push(clinicId);

    // Correct credentials, but the clinic is still Pending — login must be rejected.
    const pendingLogin = await request(app).post("/api/v1/auth/login").send({ username, password });
    expect(pendingLogin.status).toBe(403);
    expect(pendingLogin.body.error.code).toBe("CLINIC_NOT_APPROVED");

    await request(app)
      .post(`/api/v1/admin/clinics/${clinicId}/actions`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ action: "approve" });

    const approvedLogin = await request(app).post("/api/v1/auth/login").send({ username, password });
    expect(approvedLogin.status).toBe(200);
    expect(approvedLogin.body.data.accessToken).toBeTypeOf("string");

    await request(app)
      .post(`/api/v1/admin/clinics/${clinicId}/actions`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ action: "suspend" });

    const suspendedLogin = await request(app).post("/api/v1/auth/login").send({ username, password });
    expect(suspendedLogin.status).toBe(403);
    expect(suspendedLogin.body.error.code).toBe("CLINIC_NOT_APPROVED");
  });

  it("rejects a duplicate username at registration (409)", async () => {
    const username = `dup.${RUN}`;
    createdUsernames.push(username);
    const body = {
      clinicName: `Dup Clinic ${RUN}`,
      clinicEmail: `dup.${RUN}@example.com`,
      adminFullName: "Dup Admin",
      adminUsername: username,
      adminEmail: `dupadmin.${RUN}@example.com`,
      password: "Passw0rdDup",
    };
    const first = await request(app).post("/api/v1/auth/register-clinic").send(body);
    expect(first.status).toBe(201);
    createdClinicIds.push(first.body.data.clinicId);

    const second = await request(app).post("/api/v1/auth/register-clinic").send(body);
    expect(second.status).toBe(409);
  });

  it("validates registration input (400 on weak password)", async () => {
    const res = await request(app).post("/api/v1/auth/register-clinic").send({
      clinicName: "X",
      clinicEmail: "not-an-email",
      adminFullName: "Y",
      adminUsername: "z",
      adminEmail: "bad",
      password: "short",
    });
    expect(res.status).toBe(400);
  });
});
