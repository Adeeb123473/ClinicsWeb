import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { getPool, sql, closePool } from "../src/config/db.js";
import { signAccessToken } from "../src/utils/jwt.js";
import { createFullFeaturePlan } from "./helpers/testPlan.js";

const app = createApp();
const RUN = Date.now().toString(36);

// 1x1 transparent PNG.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

interface Ctx {
  clinicId: string;
  planId: string;
  doctorId: string;
  otherDoctorId: string;
  adminToken: string;
  doctorToken: string;
  otherDoctorToken: string;
  receptionToken: string;
}

async function makeClinic(label: string): Promise<Ctx> {
  const pool = await getPool();
  const planId = await createFullFeaturePlan(pool, `lh-${label}-${RUN}`);
  const clinic = await pool
    .request()
    .input("name", sql.NVarChar, `LH ${label} ${RUN}`)
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ ClinicID: string }>(
      `INSERT INTO Clinics (ClinicName, Status, SubscriptionPlanID) OUTPUT INSERTED.ClinicID VALUES (@name, 'Approved', @planId)`,
    );
  const clinicId = clinic.recordset[0].ClinicID;

  async function user(role: string, tag: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, `lh.${role}.${tag}.${label}.${RUN}`)
      .input("role", sql.NVarChar, role)
      .query<{ UserID: string }>(
        `INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName) OUTPUT INSERTED.UserID VALUES (@clinicId, @username, 'x', @role, @role)`,
      );
    return r.recordset[0].UserID;
  }

  async function doctor(userId: string, name: string): Promise<string> {
    const r = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("name", sql.NVarChar, name)
      .query<{ DoctorID: string }>(
        `INSERT INTO Doctors (ClinicID, UserID, DoctorName) OUTPUT INSERTED.DoctorID VALUES (@clinicId, @userId, @name)`,
      );
    return r.recordset[0].DoctorID;
  }

  const adminId = await user("CLINIC_ADMIN", "a");
  const docUserId = await user("DOCTOR", "d1");
  const otherDocUserId = await user("DOCTOR", "d2");
  const recId = await user("RECEPTIONIST", "r");

  return {
    clinicId,
    planId,
    doctorId: await doctor(docUserId, "Dr One"),
    otherDoctorId: await doctor(otherDocUserId, "Dr Two"),
    adminToken: signAccessToken({ sub: adminId, username: "a", role: "CLINIC_ADMIN", clinicId }),
    doctorToken: signAccessToken({ sub: docUserId, username: "d1", role: "DOCTOR", clinicId }),
    otherDoctorToken: signAccessToken({ sub: otherDocUserId, username: "d2", role: "DOCTOR", clinicId }),
    receptionToken: signAccessToken({ sub: recId, username: "r", role: "RECEPTIONIST", clinicId }),
  };
}

let A: Ctx;
let B: Ctx;

beforeAll(async () => {
  await runMigrations();
  A = await makeClinic("A");
  B = await makeClinic("B");
});

afterAll(async () => {
  const pool = await getPool();
  for (const ctx of [A, B]) {
    await pool.request().input("id", sql.UniqueIdentifier, ctx.clinicId).query(`
      DELETE FROM LetterheadImages WHERE LetterheadTemplateID IN
        (SELECT LetterheadTemplateID FROM LetterheadTemplates WHERE ClinicID = @id);
      DELETE FROM LetterheadTemplates WHERE ClinicID = @id;
      DELETE FROM AuditLogs WHERE ClinicID = @id;
      DELETE FROM Doctors WHERE ClinicID = @id;
      DELETE FROM Users WHERE ClinicID = @id;
      DELETE FROM Clinics WHERE ClinicID = @id;
    `);
    await pool
      .request()
      .input("planId", sql.UniqueIdentifier, ctx.planId)
      .query(`DELETE FROM SubscriptionPlans WHERE PlanID = @planId`);
  }
  await closePool();
});

const validBody = (over: Record<string, unknown> = {}) => ({
  mode: "OVERLAY",
  fields: [
    { key: "patientName", xMm: 40, yMm: 62, widthMm: 90, fontSizePt: 11 },
    { key: "age", xMm: 170, yMm: 62, widthMm: 25 },
  ],
  ...over,
});

const put = (token: string, doctorId: string, body: Record<string, unknown>) =>
  request(app).put(`/api/v1/doctors/${doctorId}/letterhead`).set("Authorization", `Bearer ${token}`).send(body);

describe("Letterhead templates — CRUD", () => {
  it("returns null when a doctor has no letterhead yet", async () => {
    const res = await request(app)
      .get(`/api/v1/doctors/${A.doctorId}/letterhead`)
      .set("Authorization", `Bearer ${A.doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("lets a doctor create and read back their own template", async () => {
    const res = await put(A.doctorToken, A.doctorId, validBody());
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe("OVERLAY");
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.fields).toHaveLength(2);
    expect(res.body.data.paperWidthMm).toBe(210);
    expect(res.body.data.letterheadImageUrl).toBeNull();

    const read = await request(app)
      .get(`/api/v1/doctors/${A.doctorId}/letterhead`)
      .set("Authorization", `Bearer ${A.doctorToken}`);
    expect(read.body.data.fields[0].key).toBe("patientName");
  });

  it("updates in place rather than creating a second template", async () => {
    const res = await put(A.doctorToken, A.doctorId, validBody({ globalOffsetXMm: 1.5, globalOffsetYMm: -2 }));
    expect(res.status).toBe(200);
    expect(res.body.data.globalOffsetMm).toEqual({ x: 1.5, y: -2 });

    const pool = await getPool();
    const count = await pool
      .request()
      .input("doctorId", sql.UniqueIdentifier, A.doctorId)
      .query<{ N: number }>(`SELECT COUNT(*) AS N FROM LetterheadTemplates WHERE DoctorID = @doctorId`);
    expect(count.recordset[0].N).toBe(1);
  });

  it("lets a clinic admin edit any doctor in their clinic", async () => {
    const res = await put(A.adminToken, A.otherDoctorId, validBody({ mode: "FULL" }));
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe("FULL");
  });
});

describe("Letterhead templates — authorization", () => {
  it("blocks a doctor from editing another doctor's letterhead (403)", async () => {
    const res = await put(A.otherDoctorToken, A.doctorId, validBody());
    expect(res.status).toBe(403);
  });

  it("blocks a receptionist from editing (403) but allows reading", async () => {
    const write = await put(A.receptionToken, A.doctorId, validBody());
    expect(write.status).toBe(403);

    const read = await request(app)
      .get(`/api/v1/doctors/${A.doctorId}/letterhead`)
      .set("Authorization", `Bearer ${A.receptionToken}`);
    expect(read.status).toBe(200);
  });

  it("returns 404 for a doctor in another clinic (no cross-clinic enumeration)", async () => {
    const read = await request(app)
      .get(`/api/v1/doctors/${B.doctorId}/letterhead`)
      .set("Authorization", `Bearer ${A.adminToken}`);
    expect(read.status).toBe(404);

    const write = await put(A.adminToken, B.doctorId, validBody());
    expect(write.status).toBe(404);
  });

  it("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get(`/api/v1/doctors/${A.doctorId}/letterhead`);
    expect(res.status).toBe(401);
  });
});

describe("Letterhead templates — coordinate and field validation", () => {
  it("rejects coordinates outside the paper", async () => {
    expect((await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "age", xMm: 215, yMm: 10 }] }))).status).toBe(400);
    expect((await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "age", xMm: 10, yMm: 300 }] }))).status).toBe(400);
    expect((await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "age", xMm: -1, yMm: 10 }] }))).status).toBe(400);
  });

  it("rejects a box whose extent runs off the page", async () => {
    const res = await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "patientName", xMm: 180, yMm: 10, widthMm: 40 }] }));
    expect(res.status).toBe(400);

    const ok = await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "patientName", xMm: 180, yMm: 10, widthMm: 30 }] }));
    expect(ok.status).toBe(200);
  });

  it("rejects unknown field keys and duplicates", async () => {
    expect((await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "nope", xMm: 10, yMm: 10 }] }))).status).toBe(400);
    expect(
      (await put(A.doctorToken, A.doctorId, validBody({ fields: [{ key: "age", xMm: 10, yMm: 10 }, { key: "age", xMm: 20, yMm: 20 }] }))).status,
    ).toBe(400);
  });

  it("validates inlineWith targets", async () => {
    // Points at a field that isn't on the template.
    const dangling = await put(
      A.doctorToken,
      A.doctorId,
      validBody({ fields: [{ key: "gender", xMm: 10, yMm: 10, inlineWith: "patientName" }] }),
    );
    expect(dangling.status).toBe(400);

    // Self-reference.
    const self = await put(
      A.doctorToken,
      A.doctorId,
      validBody({ fields: [{ key: "gender", xMm: 10, yMm: 10, inlineWith: "gender" }] }),
    );
    expect(self.status).toBe(400);

    // Chained inlining is rejected: composition stays a single append.
    const chained = await put(
      A.doctorToken,
      A.doctorId,
      validBody({
        fields: [
          { key: "patientName", xMm: 40, yMm: 62 },
          { key: "gender", xMm: 0, yMm: 0, inlineWith: "patientName" },
          { key: "age", xMm: 0, yMm: 0, inlineWith: "gender" },
        ],
      }),
    );
    expect(chained.status).toBe(400);

    // The valid case from the sample pad: gender appended to patient name.
    const ok = await put(
      A.doctorToken,
      A.doctorId,
      validBody({
        fields: [
          { key: "patientName", xMm: 40, yMm: 62, widthMm: 90 },
          { key: "gender", xMm: 0, yMm: 0, inlineWith: "patientName", prefix: " / " },
        ],
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.fields.find((f: { key: string }) => f.key === "gender").inlineWith).toBe("patientName");
  });
});

describe("Letterhead images", () => {
  it("stores and serves an uploaded image, and advertises its URL", async () => {
    const up = await request(app)
      .post(`/api/v1/doctors/${A.doctorId}/letterhead/image`)
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ kind: "DEWARPED", dataUrl: PNG, widthPx: 1654, heightPx: 2339 });
    expect(up.status).toBe(201);
    expect(up.body.data.letterheadImageUrl).toBe(`/api/v1/doctors/${A.doctorId}/letterhead/image/dewarped`);

    const img = await request(app)
      .get(`/api/v1/doctors/${A.doctorId}/letterhead/image/dewarped`)
      .set("Authorization", `Bearer ${A.doctorToken}`);
    expect(img.status).toBe(200);
    expect(img.headers["content-type"]).toContain("image/png");
    expect(img.body.length).toBeGreaterThan(0);
  });

  it("replaces rather than duplicates when the same kind is re-uploaded", async () => {
    await request(app)
      .post(`/api/v1/doctors/${A.doctorId}/letterhead/image`)
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ kind: "DEWARPED", dataUrl: PNG });

    const pool = await getPool();
    const n = await pool
      .request()
      .input("doctorId", sql.UniqueIdentifier, A.doctorId)
      .query<{ N: number }>(`
        SELECT COUNT(*) AS N FROM LetterheadImages i
        JOIN LetterheadTemplates t ON t.LetterheadTemplateID = i.LetterheadTemplateID
        WHERE t.DoctorID = @doctorId AND i.Kind = 'DEWARPED'
      `);
    expect(n.recordset[0].N).toBe(1);
  });

  it("rejects a non-image data URL", async () => {
    const res = await request(app)
      .post(`/api/v1/doctors/${A.doctorId}/letterhead/image`)
      .set("Authorization", `Bearer ${A.doctorToken}`)
      .send({ kind: "DEWARPED", dataUrl: "data:text/html;base64,PHNjcmlwdD4=" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an image belonging to another clinic", async () => {
    const res = await request(app)
      .get(`/api/v1/doctors/${B.doctorId}/letterhead/image/dewarped`)
      .set("Authorization", `Bearer ${A.doctorToken}`);
    expect(res.status).toBe(404);
  });
});

describe("Letterhead calibration status", () => {
  it("refuses CALIBRATED before an image exists, and allows it after", async () => {
    // otherDoctor has a template (created by the admin above) but no image.
    const early = await put(A.adminToken, A.otherDoctorId, validBody({ status: "CALIBRATED" }));
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe("LETTERHEAD_NOT_READY");

    await request(app)
      .post(`/api/v1/doctors/${A.otherDoctorId}/letterhead/image`)
      .set("Authorization", `Bearer ${A.adminToken}`)
      .send({ kind: "DEWARPED", dataUrl: PNG });

    const ok = await put(A.adminToken, A.otherDoctorId, validBody({ status: "CALIBRATED" }));
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("CALIBRATED");
  });

  it("deletes a template and its images together", async () => {
    const res = await request(app)
      .delete(`/api/v1/doctors/${A.otherDoctorId}/letterhead`)
      .set("Authorization", `Bearer ${A.adminToken}`);
    expect(res.status).toBe(200);

    const read = await request(app)
      .get(`/api/v1/doctors/${A.otherDoctorId}/letterhead`)
      .set("Authorization", `Bearer ${A.adminToken}`);
    expect(read.body.data).toBeNull();

    const pool = await getPool();
    const n = await pool
      .request()
      .input("doctorId", sql.UniqueIdentifier, A.otherDoctorId)
      .query<{ N: number }>(`
        SELECT COUNT(*) AS N FROM LetterheadImages i
        JOIN LetterheadTemplates t ON t.LetterheadTemplateID = i.LetterheadTemplateID
        WHERE t.DoctorID = @doctorId
      `);
    expect(n.recordset[0].N).toBe(0);
  });
});
