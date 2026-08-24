import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface LabTestRow {
  LabTestID: string;
  Name: string;
  Category: string | null;
  Price: number;
  IsActive: boolean;
}

export async function listTests(clinicId: string): Promise<LabTestRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .query<LabTestRow>(`SELECT LabTestID, Name, Category, Price, IsActive FROM LabTests WHERE ClinicID = @clinicId AND IsActive = 1 ORDER BY Name`);
  return result.recordset;
}

export async function insertTest(clinicId: string, name: string, category: string | null, price: number): Promise<LabTestRow> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("name", sql.NVarChar, name)
    .input("category", sql.NVarChar, category)
    .input("price", sql.Decimal(10, 2), price)
    .query<LabTestRow>(`
      INSERT INTO LabTests (ClinicID, Name, Category, Price) OUTPUT INSERTED.LabTestID, INSERTED.Name, INSERTED.Category, INSERTED.Price, INSERTED.IsActive
      VALUES (@clinicId, @name, @category, @price)
    `);
  return result.recordset[0];
}

export interface LabOrderRow {
  LabOrderID: string;
  PatientID: string;
  ConsultationID: string | null;
  LabTestID: string;
  OrderedByUserID: string;
  Status: string;
  OrderedAt: Date;
  TestName: string;
  PatientName: string;
  MRNo: string;
  ResultText: string | null;
  ReviewedAt: Date | null;
}

const ORDER_SELECT = `
  SELECT o.LabOrderID, o.PatientID, o.ConsultationID, o.LabTestID, o.OrderedByUserID, o.Status, o.OrderedAt,
    t.Name AS TestName, p.PatientName, p.MRNo, r.ResultText, r.ReviewedAt
  FROM LabOrders o
  JOIN LabTests t ON t.LabTestID = o.LabTestID
  JOIN Patients p ON p.PatientID = o.PatientID
  LEFT JOIN LabResults r ON r.LabOrderID = o.LabOrderID
`;

export async function listOrders(clinicId: string, patientId?: string, status?: string): Promise<LabOrderRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId ?? null)
    .input("status", sql.NVarChar, status ?? null)
    .query<LabOrderRow>(`
      ${ORDER_SELECT}
      WHERE o.ClinicID = @clinicId
        AND (@patientId IS NULL OR o.PatientID = @patientId)
        AND (@status IS NULL OR o.Status = @status)
      ORDER BY o.OrderedAt DESC
    `);
  return result.recordset;
}

export interface BillableLabOrderRow {
  LabOrderID: string;
  PatientID: string;
  LabTestID: string;
  Status: string;
  OrderedAt: Date;
  TestName: string;
  Price: number;
  PatientName: string;
  MRNo: string;
}

/**
 * Lab orders for one patient that can still be charged: not cancelled, and not already sitting
 * on a live (non-Void) invoice. Voiding an invoice therefore frees its orders to be re-billed.
 *
 * This is the query behind reception's billing screen, so unlike ORDER_SELECT it deliberately
 * does NOT join LabResults — a receptionist must never receive result text (CLAUDE.md §2).
 */
export async function listBillableOrders(clinicId: string, patientId: string): Promise<BillableLabOrderRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .query<BillableLabOrderRow>(`
      SELECT o.LabOrderID, o.PatientID, o.LabTestID, o.Status, o.OrderedAt,
        t.Name AS TestName, t.Price, p.PatientName, p.MRNo
      FROM LabOrders o
      JOIN LabTests t ON t.LabTestID = o.LabTestID
      JOIN Patients p ON p.PatientID = o.PatientID
      WHERE o.ClinicID = @clinicId AND o.PatientID = @patientId
        AND o.Status <> 'Cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM InvoiceItems ii
          JOIN Invoices inv ON inv.InvoiceID = ii.InvoiceID
          WHERE ii.LabOrderID = o.LabOrderID AND inv.Status <> 'Void'
        )
      ORDER BY o.OrderedAt DESC
    `);
  return result.recordset;
}

export async function findOrder(clinicId: string, orderId: string): Promise<LabOrderRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("orderId", sql.UniqueIdentifier, orderId)
    .query<LabOrderRow>(`${ORDER_SELECT} WHERE o.ClinicID = @clinicId AND o.LabOrderID = @orderId`);
  return result.recordset[0] ?? null;
}

export async function insertOrder(
  clinicId: string,
  patientId: string,
  consultationId: string | null,
  labTestId: string,
  orderedBy: string,
): Promise<string> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .input("consultationId", sql.UniqueIdentifier, consultationId)
    .input("labTestId", sql.UniqueIdentifier, labTestId)
    .input("orderedBy", sql.UniqueIdentifier, orderedBy)
    .query<{ LabOrderID: string }>(`
      INSERT INTO LabOrders (ClinicID, PatientID, ConsultationID, LabTestID, OrderedByUserID)
      OUTPUT INSERTED.LabOrderID VALUES (@clinicId, @patientId, @consultationId, @labTestId, @orderedBy)
    `);
  return result.recordset[0].LabOrderID;
}

export async function setOrderStatus(clinicId: string, orderId: string, status: string): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("orderId", sql.UniqueIdentifier, orderId)
    .input("status", sql.NVarChar, status)
    .query(`UPDATE LabOrders SET Status = @status WHERE ClinicID = @clinicId AND LabOrderID = @orderId`);
}

/** Upserts the result for an order and marks the order Completed. */
export async function saveResult(orderId: string, resultText: string, reviewedBy: string): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("orderId", sql.UniqueIdentifier, orderId)
    .input("resultText", sql.NVarChar(sql.MAX), resultText)
    .input("reviewedBy", sql.UniqueIdentifier, reviewedBy)
    .query(`
      IF EXISTS (SELECT 1 FROM LabResults WHERE LabOrderID = @orderId)
        UPDATE LabResults SET ResultText = @resultText, ReviewedByUserID = @reviewedBy, ReviewedAt = SYSUTCDATETIME() WHERE LabOrderID = @orderId;
      ELSE
        INSERT INTO LabResults (LabOrderID, ResultText, ReviewedByUserID, ReviewedAt) VALUES (@orderId, @resultText, @reviewedBy, SYSUTCDATETIME());
      UPDATE LabOrders SET Status = 'Completed' WHERE LabOrderID = @orderId;
    `);
}
