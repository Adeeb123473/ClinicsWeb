import { getPool, sql } from "../../config/db.js";

export interface PlanRow {
  PlanID: string;
  Name: string;
  PriceMonthly: number;
  MaxUsers: number | null;
  MaxPatients: number | null;
  Features: string | null;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface PlanInput {
  name: string;
  priceMonthly: number;
  maxUsers: number | null;
  maxPatients: number | null;
  features: string[];
  isActive: boolean;
}

/** Plans are a platform-level resource (not clinic-scoped): only SUPER_ADMIN reaches this layer. */
export async function listPlans(): Promise<PlanRow[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query<PlanRow>(`SELECT * FROM SubscriptionPlans ORDER BY PriceMonthly ASC`);
  return result.recordset;
}

/** Only active plans, for the public pricing page. */
export async function listActivePlans(): Promise<PlanRow[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .query<PlanRow>(`SELECT * FROM SubscriptionPlans WHERE IsActive = 1 ORDER BY PriceMonthly ASC`);
  return result.recordset;
}

export async function findPlanById(planId: string): Promise<PlanRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("planId", sql.UniqueIdentifier, planId)
    .query<PlanRow>(`SELECT * FROM SubscriptionPlans WHERE PlanID = @planId`);
  return result.recordset[0] ?? null;
}

export async function insertPlan(input: PlanInput): Promise<PlanRow> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("price", sql.Decimal(10, 2), input.priceMonthly)
    .input("maxUsers", sql.Int, input.maxUsers)
    .input("maxPatients", sql.Int, input.maxPatients)
    .input("features", sql.NVarChar(sql.MAX), JSON.stringify(input.features))
    .input("isActive", sql.Bit, input.isActive)
    .query<PlanRow>(`
      INSERT INTO SubscriptionPlans (Name, PriceMonthly, MaxUsers, MaxPatients, Features, IsActive)
      OUTPUT INSERTED.*
      VALUES (@name, @price, @maxUsers, @maxPatients, @features, @isActive)
    `);
  return result.recordset[0];
}

export async function updatePlan(planId: string, input: PlanInput): Promise<PlanRow | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("planId", sql.UniqueIdentifier, planId)
    .input("name", sql.NVarChar, input.name)
    .input("price", sql.Decimal(10, 2), input.priceMonthly)
    .input("maxUsers", sql.Int, input.maxUsers)
    .input("maxPatients", sql.Int, input.maxPatients)
    .input("features", sql.NVarChar(sql.MAX), JSON.stringify(input.features))
    .input("isActive", sql.Bit, input.isActive)
    .query<PlanRow>(`
      UPDATE SubscriptionPlans
      SET Name = @name, PriceMonthly = @price, MaxUsers = @maxUsers,
          MaxPatients = @maxPatients, Features = @features, IsActive = @isActive,
          UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE PlanID = @planId
    `);
  return result.recordset[0] ?? null;
}

export async function countClinicsOnPlan(planId: string): Promise<number> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM Clinics WHERE SubscriptionPlanID = @planId`);
  return result.recordset[0].cnt;
}

export async function deletePlan(planId: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("planId", sql.UniqueIdentifier, planId)
    .query(`DELETE FROM SubscriptionPlans WHERE PlanID = @planId`);
}
