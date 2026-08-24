import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface InvoiceRow {
  InvoiceID: string;
  ClinicID: string;
  PatientID: string;
  AppointmentID: string | null;
  InvoiceNo: string;
  Subtotal: number;
  Discount: number;
  Tax: number;
  Total: number;
  PaidAmount: number;
  Status: string;
  CreatedAt: Date;
  PatientName: string;
  MRNo: string;
}

export interface InvoiceItemRow {
  InvoiceItemID: string;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  Amount: number;
  LabOrderID: string | null;
}

export interface PaymentRow {
  PaymentID: string;
  Amount: number;
  PaymentMethod: string;
  PaidAt: Date;
}

const INVOICE_SELECT = `
  SELECT i.*, p.PatientName, p.MRNo
  FROM Invoices i JOIN Patients p ON p.PatientID = i.PatientID
`;

export async function listInvoices(clinicId: string, patientId?: string, status?: string): Promise<InvoiceRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId ?? null)
    .input("status", sql.NVarChar, status ?? null)
    .query<InvoiceRow>(`
      ${INVOICE_SELECT}
      WHERE i.ClinicID = @clinicId
        AND (@patientId IS NULL OR i.PatientID = @patientId)
        AND (@status IS NULL OR i.Status = @status)
      ORDER BY i.CreatedAt DESC
    `);
  return result.recordset;
}

export async function findInvoiceById(clinicId: string, invoiceId: string): Promise<InvoiceRow | null> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("invoiceId", sql.UniqueIdentifier, invoiceId)
    .query<InvoiceRow>(`${INVOICE_SELECT} WHERE i.ClinicID = @clinicId AND i.InvoiceID = @invoiceId`);
  return result.recordset[0] ?? null;
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItemRow[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("invoiceId", sql.UniqueIdentifier, invoiceId)
    .query<InvoiceItemRow>(`SELECT * FROM InvoiceItems WHERE InvoiceID = @invoiceId`);
  return result.recordset;
}

export async function getInvoicePayments(clinicId: string, invoiceId: string): Promise<PaymentRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("invoiceId", sql.UniqueIdentifier, invoiceId)
    .query<PaymentRow>(`
      SELECT PaymentID, Amount, PaymentMethod, PaidAt FROM Payments
      WHERE ClinicID = @clinicId AND InvoiceID = @invoiceId ORDER BY PaidAt
    `);
  return result.recordset;
}

export interface CreateInvoiceInput {
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  invoicePrefix: string;
  discount: number;
  taxPercent: number;
  createdBy: string;
  items: { description: string; quantity: number; unitPrice: number; labOrderId?: string | null }[];
}

export async function insertInvoice(input: CreateInvoiceInput): Promise<string> {
  assertClinicId(input.clinicId);
  const pool = await getPool();
  const subtotal = input.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const taxable = Math.max(0, subtotal - input.discount);
  const tax = Math.round(taxable * (input.taxPercent / 100) * 100) / 100;
  const total = taxable + tax;

  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const year = new Date().getFullYear();
    const seqResult = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, input.clinicId)
      .input("prefix", sql.NVarChar, `${input.invoicePrefix}-${year}-%`)
      .query<{ MaxSeq: number }>(`
        SELECT ISNULL(MAX(TRY_CONVERT(INT, RIGHT(InvoiceNo, 5))), 0) AS MaxSeq
        FROM Invoices WITH (UPDLOCK, HOLDLOCK)
        WHERE ClinicID = @clinicId AND InvoiceNo LIKE @prefix
      `);
    const invoiceNo = `${input.invoicePrefix}-${year}-${String((seqResult.recordset[0].MaxSeq ?? 0) + 1).padStart(5, "0")}`;

    const invoiceResult = await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, input.clinicId)
      .input("patientId", sql.UniqueIdentifier, input.patientId)
      .input("appointmentId", sql.UniqueIdentifier, input.appointmentId)
      .input("invoiceNo", sql.NVarChar, invoiceNo)
      .input("subtotal", sql.Decimal(12, 2), subtotal)
      .input("discount", sql.Decimal(12, 2), input.discount)
      .input("tax", sql.Decimal(12, 2), tax)
      .input("total", sql.Decimal(12, 2), total)
      .input("createdBy", sql.UniqueIdentifier, input.createdBy)
      .query<{ InvoiceID: string }>(`
        INSERT INTO Invoices (ClinicID, PatientID, AppointmentID, InvoiceNo, Subtotal, Discount, Tax, Total, PaidAmount, Status, CreatedBy)
        OUTPUT INSERTED.InvoiceID
        VALUES (@clinicId, @patientId, @appointmentId, @invoiceNo, @subtotal, @discount, @tax, @total, 0, 'Unpaid', @createdBy)
      `);
    const invoiceId = invoiceResult.recordset[0].InvoiceID;

    for (const it of input.items) {
      await new sql.Request(transaction)
        .input("invoiceId", sql.UniqueIdentifier, invoiceId)
        .input("description", sql.NVarChar, it.description)
        .input("qty", sql.Int, it.quantity)
        .input("unitPrice", sql.Decimal(12, 2), it.unitPrice)
        .input("amount", sql.Decimal(12, 2), it.quantity * it.unitPrice)
        .input("labOrderId", sql.UniqueIdentifier, it.labOrderId ?? null)
        .query(`
          INSERT INTO InvoiceItems (InvoiceID, Description, Quantity, UnitPrice, Amount, LabOrderID)
          VALUES (@invoiceId, @description, @qty, @unitPrice, @amount, @labOrderId)
        `);
    }

    await transaction.commit();
    return invoiceId;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/** Records a payment and re-derives the invoice PaidAmount/Status atomically. */
export async function insertPayment(
  clinicId: string,
  invoiceId: string,
  amount: number,
  method: string,
  receivedBy: string,
): Promise<void> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("invoiceId", sql.UniqueIdentifier, invoiceId)
      .input("amount", sql.Decimal(12, 2), amount)
      .input("method", sql.NVarChar, method)
      .input("receivedBy", sql.UniqueIdentifier, receivedBy)
      .query(`
        INSERT INTO Payments (ClinicID, InvoiceID, Amount, PaymentMethod, ReceivedByUserID)
        VALUES (@clinicId, @invoiceId, @amount, @method, @receivedBy)
      `);

    await new sql.Request(transaction)
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("invoiceId", sql.UniqueIdentifier, invoiceId)
      .query(`
        UPDATE Invoices
        SET PaidAmount = paid.Total,
            Status = CASE WHEN paid.Total >= Invoices.Total THEN 'Paid'
                          WHEN paid.Total > 0 THEN 'PartiallyPaid' ELSE 'Unpaid' END
        FROM (SELECT ISNULL(SUM(Amount),0) AS Total FROM Payments WHERE InvoiceID = @invoiceId) paid
        WHERE Invoices.ClinicID = @clinicId AND Invoices.InvoiceID = @invoiceId
      `);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
