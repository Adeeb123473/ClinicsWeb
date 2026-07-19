import { sql } from "../../src/config/db.js";

/**
 * Creates a subscription plan with every gated feature and returns its PlanID, so test
 * fixtures can assign it to a clinic. Since Phase-2's plan-feature gating middleware
 * (requireFeature) fails closed for clinics with no plan, any fixture clinic that calls
 * appointments/billing/reports/lab routes needs one of these.
 */
export async function createFullFeaturePlan(pool: sql.ConnectionPool, uniqueSuffix: string): Promise<string> {
  const result = await pool
    .request()
    .input("name", sql.NVarChar, `Test Full Plan ${uniqueSuffix}`)
    .input("features", sql.NVarChar(sql.MAX), JSON.stringify(["appointments", "billing", "reports", "lab", "api"]))
    .query<{ PlanID: string }>(`
      INSERT INTO SubscriptionPlans (Name, PriceMonthly, Features)
      OUTPUT INSERTED.PlanID
      VALUES (@name, 0, @features)
    `);
  return result.recordset[0].PlanID;
}
