import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { signAccessToken } from "../src/utils/jwt.js";

const app = createApp();
const RUN = Date.now().toString(36);

interface ClinicCtx {
  clinicId: string;
  planId: string | null;
  adminToken: string;
  receptionToken: string;
  doctorToken: string;
}

/** Creates a clinic with the given plan features (or no plan at all when `features` is null). */
async function makeClinic(label: string, features: string[] | null): Promise<ClinicCtx> {
  const pool = await getPool();

  let planId: string | null = null;
  if (features) {
    const plan = await pool
      .request()
      .input("name", sql.NVarChar, `Gate Plan ${label} ${RUN}`)
      .input("features", sql.NVarChar(sql.MAX), JSON.stringify(features))
      .query<{ PlanID: string }>(
        `INSERT INTO SubscriptionPlans (Name, PriceMonthly, Features) OUTPUT INSERTED.PlanID VALUES (@name, 0, @features)`,
      );
    planId = plan.recordset[0].PlanID;
  }

  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `Gate Clinic ${label} ${RUN}`)
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ ClinicID: string }>(
      `INSERT INTO Clinics (ClinicName, Status, SubscriptionPlanID) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved', @planId)`,
    );
  const clinicId = clinic.recordset[0].ClinicID;

  async function user(role: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, `gate.${role}.${label}.${RUN}`)
      .input("role", sql.NVarChar, role)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (@clinicId, @username, 'x', @role, @role)`,
      );
    return r.recordset[0].UserID;
  }

  const adminId = await user("CLINIC_ADMIN");
  const recId = await user("RECEPTIONIST");
  const docUserId = await user("DOCTOR");

  return {
    clinicId,
    planId,
    adminToken: signAccessToken({ sub: adminId, username: "a", role: "CLINIC_ADMIN", clinicId }),
    receptionToken: signAccessToken({ sub: recId, username: "r", role: "RECEPTIONIST", clinicId }),
    doctorToken: signAccessToken({ sub: docUserId, username: "d", role: "DOCTOR", clinicId }),
  };
}

async function cleanup(ctx: ClinicCtx): Promise<void> {
  const pool = await getPool();
  await pool.request().input("id", sql.UniqueIdentifier, ctx.clinicId).query(`
    DELETE FROM AuditLogs WHERE ClinicID = @id;
    DELETE FROM ClinicSubscriptions WHERE ClinicID = @id;
    DELETE FROM Doctors WHERE ClinicID = @id;
    DELETE FROM Users WHERE ClinicID = @id;
    DELETE FROM Clinics WHERE ClinicID = @id;
  `);
  if (ctx.planId) {
    await pool.request().input("planId", sql.UniqueIdentifier, ctx.planId).query(`DELETE FROM SubscriptionPlans WHERE PlanID = @planId`);
  }
}

let starterOnly: ClinicCtx; // plan has ["appointments"] only — no billing/reports/lab
let fullPlan: ClinicCtx; // plan has all 4 gated features
let noPlan: ClinicCtx; // SubscriptionPlanID is NULL

beforeAll(async () => {
  await runMigrations();
  starterOnly = await makeClinic("starter", ["appointments"]);
  fullPlan = await makeClinic("full", ["appointments", "billing", "reports", "lab"]);
  noPlan = await makeClinic("none", null);
});

afterAll(async () => {
  await cleanup(starterOnly);
  await cleanup(fullPlan);
  await cleanup(noPlan);
  await closePool();
});

describe("Plan feature gating", () => {
  it("allows a feature that IS included in the clinic's plan", async () => {
    const res = await request(app).get("/api/v1/appointments").set("Authorization", `Bearer ${starterOnly.receptionToken}`);
    expect(res.status).toBe(200);
  });

  it("blocks a feature NOT included in the clinic's plan (403 PLAN_FEATURE_NOT_INCLUDED)", async () => {
    const res = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${starterOnly.receptionToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("PLAN_FEATURE_NOT_INCLUDED");
  });

  it("blocks the reports and lab modules when the plan omits them", async () => {
    const reports = await request(app).get("/api/v1/reports/dashboard").set("Authorization", `Bearer ${starterOnly.adminToken}`);
    expect(reports.status).toBe(403);
    expect(reports.body.error.code).toBe("PLAN_FEATURE_NOT_INCLUDED");

    const lab = await request(app).get("/api/v1/lab/orders").set("Authorization", `Bearer ${starterOnly.doctorToken}`);
    expect(lab.status).toBe(403);
    expect(lab.body.error.code).toBe("PLAN_FEATURE_NOT_INCLUDED");
  });

  it("allows every gated module when the plan includes all features", async () => {
    const appt = await request(app).get("/api/v1/appointments").set("Authorization", `Bearer ${fullPlan.receptionToken}`);
    expect(appt.status).toBe(200);

    const billing = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${fullPlan.receptionToken}`);
    expect(billing.status).toBe(200);

    const reports = await request(app).get("/api/v1/reports/dashboard").set("Authorization", `Bearer ${fullPlan.adminToken}`);
    expect(reports.status).toBe(200);

    const lab = await request(app).get("/api/v1/lab/orders").set("Authorization", `Bearer ${fullPlan.doctorToken}`);
    expect(lab.status).toBe(200);
  });

  it("fails closed (blocks all gated features) for a clinic with no plan assigned", async () => {
    const appt = await request(app).get("/api/v1/appointments").set("Authorization", `Bearer ${noPlan.receptionToken}`);
    expect(appt.status).toBe(403);
    expect(appt.body.error.code).toBe("PLAN_FEATURE_NOT_INCLUDED");

    const billing = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${noPlan.receptionToken}`);
    expect(billing.status).toBe(403);
  });

  it("takes effect immediately when the Super Admin changes the clinic's plan", async () => {
    const before = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${starterOnly.receptionToken}`);
    expect(before.status).toBe(403);

    const superToken = signAccessToken({ sub: "00000000-0000-0000-0000-000000000000", username: "s", role: "SUPER_ADMIN", clinicId: null });
    const assign = await request(app)
      .post(`/api/v1/admin/clinics/${starterOnly.clinicId}/plan`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ planId: fullPlan.planId });
    expect(assign.status).toBe(200);

    const after = await request(app).get("/api/v1/billing/invoices").set("Authorization", `Bearer ${starterOnly.receptionToken}`);
    expect(after.status).toBe(200);

    // Restore original plan assignment so afterAll's SubscriptionPlans cleanup for starterOnly isn't FK-blocked.
    await request(app)
      .post(`/api/v1/admin/clinics/${starterOnly.clinicId}/plan`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ planId: starterOnly.planId });
  });
});
