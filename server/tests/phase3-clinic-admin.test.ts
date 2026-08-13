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
  adminToken: string;
  adminUserId: string;
  receptionToken: string;
}

async function makeClinic(label: string): Promise<Ctx> {
  const pool = await getPool();
  const planId = await createFullFeaturePlan(pool, `p3-${label}-${RUN}`);
  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `P3 ${label} ${RUN}`)
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ ClinicID: string }>(
      `INSERT INTO Clinics (ClinicName, Status, SubscriptionPlanID) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved', @planId)`,
    );
  const clinicId = clinic.recordset[0].ClinicID;

  async function user(role: string, uname: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, uname)
      .input("hash", sql.NVarChar, "x")
      .input("role", sql.NVarChar, role)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName)
         OUTPUT INSERTED.UserID VALUES (@clinicId, @username, @hash, @role, @role)`,
      );
    return r.recordset[0].UserID;
  }

  const adminUserId = await user("CLINIC_ADMIN", `p3.admin.${label}.${RUN}`);
  const recId = await user("RECEPTIONIST", `p3.rec.${label}.${RUN}`);

  return {
    clinicId,
    planId,
    adminUserId,
    adminToken: signAccessToken({ sub: adminUserId, username: "a", role: "CLINIC_ADMIN", clinicId }),
    receptionToken: signAccessToken({ sub: recId, username: "r", role: "RECEPTIONIST", clinicId }),
  };
}

let A: Ctx;
let B: Ctx;
let superToken: string;
const createdUsernames: string[] = [];

beforeAll(async () => {
  await runMigrations();
  A = await makeClinic("A");
  B = await makeClinic("B");
  superToken = signAccessToken({ sub: "00000000-0000-0000-0000-000000000000", username: "s", role: "SUPER_ADMIN", clinicId: null });
});

afterAll(async () => {
  const pool = await getPool();
  for (const ctx of [A, B]) {
    await pool.request().input("id", sql.UniqueIdentifier, ctx.clinicId).query(`
      DELETE FROM AuditLogs WHERE ClinicID = @id;
      DELETE FROM Doctors WHERE ClinicID = @id;
      DELETE FROM Users WHERE ClinicID = @id;
      DELETE FROM Clinics WHERE ClinicID = @id;
    `);
    await pool.request().input("planId", sql.UniqueIdentifier, ctx.planId).query(`DELETE FROM SubscriptionPlans WHERE PlanID = @planId`);
  }
  await closePool();
});

describe("Phase 3 — staff management RBAC", () => {
  it("lets CLINIC_ADMIN list their clinic staff", async () => {
    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${A.adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks a RECEPTIONIST from staff management (403)", async () => {
    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${A.receptionToken}`);
    expect(res.status).toBe(403);
  });

  it("blocks SUPER_ADMIN from clinic-scoped staff (403 via tenantScope)", async () => {
    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${superToken}`);
    expect(res.status).toBe(403);
  });

  it("creates a DOCTOR staff member and provisions the linked doctor profile", async () => {
    const username = `p3.newdoc.${RUN}`;
    createdUsernames.push(username);
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${A.adminToken}`)
      .send({
        username,
        password: "Passw0rdDoc",
        role: "DOCTOR",
        fullName: "Dr. New Hire",
        specialization: "Cardiology",
        consultationFee: 2000,
        followUpFee: 1000,
        roomNo: "201",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.doctor).not.toBeNull();
    expect(res.body.data.doctor.specialization).toBe("Cardiology");
    expect(res.body.data.doctor.consultationFee).toBe(2000);
  });

  it("rejects a duplicate username (409)", async () => {
    const username = `p3.dupstaff.${RUN}`;
    createdUsernames.push(username);
    const body = { username, password: "Passw0rdX1", role: "NURSE", fullName: "Nurse Dup" };
    const first = await request(app).post("/api/v1/users").set("Authorization", `Bearer ${A.adminToken}`).send(body);
    expect(first.status).toBe(201);
    const second = await request(app).post("/api/v1/users").set("Authorization", `Bearer ${A.adminToken}`).send(body);
    expect(second.status).toBe(409);
  });

  it("returns 404 when admin of clinic A edits a user of clinic B (tenant isolation)", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${B.adminUserId}`)
      .set("Authorization", `Bearer ${A.adminToken}`)
      .send({ fullName: "Hacked", status: "Inactive" });
    expect(res.status).toBe(404);
  });

  it("prevents an admin from deactivating their own account (400)", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${A.adminUserId}`)
      .set("Authorization", `Bearer ${A.adminToken}`)
      .send({ fullName: "Self", status: "Inactive" });
    expect(res.status).toBe(400);
  });
});

describe("Phase 3 — clinic settings RBAC", () => {
  it("lets CLINIC_ADMIN read and update settings", async () => {
    const read = await request(app).get("/api/v1/clinic-settings").set("Authorization", `Bearer ${A.adminToken}`);
    expect(read.status).toBe(200);

    const update = await request(app)
      .put("/api/v1/clinic-settings")
      .set("Authorization", `Bearer ${A.adminToken}`)
      .send({
        clinicName: read.body.data.clinicName,
        timeZone: "Asia/Karachi",
        operatingHours: read.body.data.operatingHours,
        settings: { taxPercent: 5, mrNoFormat: "MR-{YYYY}-{seq}" },
      });
    expect(update.status).toBe(200);
    expect(update.body.data.settings.taxPercent).toBe(5);
  });

  it("rejects an MR No format missing the {YYYY}/{seq} placeholders (400)", async () => {
    const read = await request(app).get("/api/v1/clinic-settings").set("Authorization", `Bearer ${A.adminToken}`);
    const save = (mrNoFormat: string) =>
      request(app)
        .put("/api/v1/clinic-settings")
        .set("Authorization", `Bearer ${A.adminToken}`)
        .send({
          clinicName: read.body.data.clinicName,
          timeZone: "Asia/Karachi",
          operatingHours: read.body.data.operatingHours,
          settings: { mrNoFormat },
        });

    // A hand-filled literal would give every patient in the clinic the same MR number.
    expect((await save("MR-{2026}-{001}")).status).toBe(400);
    // Missing {seq} entirely — same problem.
    expect((await save("MR-{YYYY}-001")).status).toBe(400);
    // Missing {YYYY} breaks the per-year sequence scoping.
    expect((await save("MR-{seq}")).status).toBe(400);
    // The valid form still saves.
    expect((await save("MR-{YYYY}-{seq}")).status).toBe(200);
  });

  it("lets a RECEPTIONIST read settings but not update them (403)", async () => {
    const read = await request(app).get("/api/v1/clinic-settings").set("Authorization", `Bearer ${A.receptionToken}`);
    expect(read.status).toBe(200);

    const update = await request(app)
      .put("/api/v1/clinic-settings")
      .set("Authorization", `Bearer ${A.receptionToken}`)
      .send({ clinicName: "X", timeZone: "Asia/Karachi", operatingHours: {}, settings: {} });
    expect(update.status).toBe(403);
  });
});

describe("Phase 3 — reports RBAC", () => {
  it("lets CLINIC_ADMIN read the dashboard and export CSV", async () => {
    const dash = await request(app).get("/api/v1/reports/dashboard").set("Authorization", `Bearer ${A.adminToken}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.summary).toBeDefined();

    const csv = await request(app).get("/api/v1/reports/export/patients").set("Authorization", `Bearer ${A.adminToken}`);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.text.split("\n")[0]).toContain("MR No");
  });

  it("blocks a RECEPTIONIST from reports (403)", async () => {
    const res = await request(app).get("/api/v1/reports/dashboard").set("Authorization", `Bearer ${A.receptionToken}`);
    expect(res.status).toBe(403);
  });
});
