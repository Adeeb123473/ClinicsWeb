import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { signAccessToken } from "../src/utils/jwt.js";

const app = createApp();
const RUN = Date.now().toString(36);

let superToken: string;
let clinicAdminToken: string;
let clinicId: string;
let superAdminUserId: string;
const createdAnnouncementIds: string[] = [];

beforeAll(async () => {
  await runMigrations();
  const pool = await getPool();

  // A real SUPER_ADMIN user (ClinicID NULL) so CreatedBy/UpdatedBy FKs resolve.
  const superUser = await pool
    .request()
    .input("username", sql.NVarChar, `platform.super.${RUN}`)
    .query<{ UserID: string }>(
      `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (NULL, @username, 'x', 'SUPER_ADMIN', 'Platform Super')`,
    );
  superAdminUserId = superUser.recordset[0].UserID;

  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `Platform Clinic ${RUN}`)
    .query<{ ClinicID: string }>(`INSERT INTO Clinics (ClinicName, Status) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved')`);
  clinicId = clinic.recordset[0].ClinicID;

  const admin = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("username", sql.NVarChar, `platform.admin.${RUN}`)
    .query<{ UserID: string }>(
      `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (@clinicId, @username, 'x', 'CLINIC_ADMIN', 'Admin')`,
    );

  superToken = signAccessToken({ sub: superAdminUserId, username: "s", role: "SUPER_ADMIN", clinicId: null });
  clinicAdminToken = signAccessToken({ sub: admin.recordset[0].UserID, username: "a", role: "CLINIC_ADMIN", clinicId });
});

afterAll(async () => {
  const pool = await getPool();
  for (const id of createdAnnouncementIds) {
    await pool.request().input("id", sql.UniqueIdentifier, id).query(`DELETE FROM Announcements WHERE AnnouncementID = @id`);
  }
  // Restore registration and clear the UpdatedBy FK so the super-admin user can be removed.
  await pool.request().query(`
    IF EXISTS (SELECT 1 FROM PlatformSettings WHERE Id = 1)
      UPDATE PlatformSettings SET Settings = '{"allowClinicRegistration":true}', UpdatedBy = NULL WHERE Id = 1;
  `);
  // AuditLogs may reference the super-admin user; clear those references first.
  await pool.request().input("uid", sql.UniqueIdentifier, superAdminUserId).query(`DELETE FROM AuditLogs WHERE UserID = @uid`);
  await pool.request().input("id", sql.UniqueIdentifier, clinicId).query(`
    DELETE FROM AuditLogs WHERE ClinicID = @id;
    DELETE FROM Users WHERE ClinicID = @id;
    DELETE FROM Clinics WHERE ClinicID = @id;
  `);
  await pool.request().input("uid", sql.UniqueIdentifier, superAdminUserId).query(`DELETE FROM Users WHERE UserID = @uid`);
  await closePool();
});

describe("Platform settings & announcements", () => {
  it("lets SUPER_ADMIN read and update platform settings", async () => {
    const read = await request(app).get("/api/v1/admin/platform/settings").set("Authorization", `Bearer ${superToken}`);
    expect(read.status).toBe(200);
    expect(read.body.data.platformName).toBeDefined();

    const update = await request(app)
      .put("/api/v1/admin/platform/settings")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ platformName: "ClinicOS", supportEmail: "help@clinicos.io", allowClinicRegistration: true, maintenanceMode: false });
    expect(update.status).toBe(200);
    expect(update.body.data.supportEmail).toBe("help@clinicos.io");
  });

  it("blocks a CLINIC_ADMIN from platform settings (403)", async () => {
    const res = await request(app).get("/api/v1/admin/platform/settings").set("Authorization", `Bearer ${clinicAdminToken}`);
    expect(res.status).toBe(403);
  });

  it("publishes an announcement that clinics see as active", async () => {
    const create = await request(app)
      .post("/api/v1/admin/platform/announcements")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ title: `Notice ${RUN}`, body: "Heads up", level: "warning" });
    expect(create.status).toBe(201);
    createdAnnouncementIds.push(create.body.data.announcementId);

    const active = await request(app).get("/api/v1/announcements/active").set("Authorization", `Bearer ${clinicAdminToken}`);
    expect(active.status).toBe(200);
    expect(active.body.data.some((a: { title: string }) => a.title === `Notice ${RUN}`)).toBe(true);
  });

  it("hides deactivated announcements from the active feed", async () => {
    const create = await request(app)
      .post("/api/v1/admin/platform/announcements")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ title: `Toggle ${RUN}`, level: "info" });
    const id = create.body.data.announcementId;
    createdAnnouncementIds.push(id);

    await request(app).patch(`/api/v1/admin/platform/announcements/${id}`).set("Authorization", `Bearer ${superToken}`).send({ isActive: false });

    const active = await request(app).get("/api/v1/announcements/active").set("Authorization", `Bearer ${clinicAdminToken}`);
    expect(active.body.data.some((a: { title: string }) => a.title === `Toggle ${RUN}`)).toBe(false);
  });

  it("disables public clinic registration when the toggle is off (403)", async () => {
    await request(app)
      .put("/api/v1/admin/platform/settings")
      .set("Authorization", `Bearer ${superToken}`)
      .send({ platformName: "ClinicOS", supportEmail: "help@clinicos.io", allowClinicRegistration: false, maintenanceMode: false });

    const reg = await request(app).post("/api/v1/auth/register-clinic").send({
      clinicName: `Blocked ${RUN}`,
      clinicEmail: `blocked.${RUN}@example.com`,
      adminFullName: "Blocked Admin",
      adminUsername: `blocked.${RUN}`,
      adminEmail: `blockedadmin.${RUN}@example.com`,
      password: "Passw0rdBlk",
    });
    expect(reg.status).toBe(403);
    expect(reg.body.error.code).toBe("REGISTRATION_DISABLED");
  });
});
