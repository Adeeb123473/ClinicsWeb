import { ApiError } from "../../utils/ApiError.js";
import { findPatientByIdForClinic } from "../patients/patients.repository.js";
import { loadClinicSettings } from "../clinicSettings/settings.service.js";
import {
  listInvoices,
  findInvoiceById,
  getInvoiceItems,
  getInvoicePayments,
  insertInvoice,
  insertPayment,
  type InvoiceRow,
} from "./billing.repository.js";

function toInvoiceSummary(row: InvoiceRow) {
  return {
    invoiceId: row.InvoiceID,
    patientId: row.PatientID,
    appointmentId: row.AppointmentID,
    invoiceNo: row.InvoiceNo,
    subtotal: Number(row.Subtotal),
    discount: Number(row.Discount),
    tax: Number(row.Tax),
    total: Number(row.Total),
    paidAmount: Number(row.PaidAmount),
    status: row.Status,
    createdAt: row.CreatedAt,
    patientName: row.PatientName,
    mrNo: row.MRNo,
  };
}

export async function getInvoices(clinicId: string, patientId?: string, status?: string) {
  return (await listInvoices(clinicId, patientId, status)).map(toInvoiceSummary);
}

export async function getInvoice(clinicId: string, invoiceId: string) {
  const row = await findInvoiceById(clinicId, invoiceId);
  if (!row) throw ApiError.notFound("Invoice not found");
  const [items, payments] = await Promise.all([getInvoiceItems(invoiceId), getInvoicePayments(clinicId, invoiceId)]);
  return {
    ...toInvoiceSummary(row),
    items: items.map((it) => ({
      description: it.Description,
      quantity: it.Quantity,
      unitPrice: Number(it.UnitPrice),
      amount: Number(it.Amount),
    })),
    payments: payments.map((p) => ({
      paymentId: p.PaymentID,
      amount: Number(p.Amount),
      method: p.PaymentMethod,
      paidAt: p.PaidAt,
    })),
  };
}

export interface CreateInvoiceBody {
  patientId: string;
  appointmentId?: string | null;
  discount?: number;
  items: { description: string; quantity: number; unitPrice: number }[];
}

export async function createInvoice(clinicId: string, createdBy: string, body: CreateInvoiceBody) {
  const patient = await findPatientByIdForClinic(clinicId, body.patientId);
  if (!patient) throw ApiError.notFound("Patient not found");
  if (!body.items.length) throw ApiError.badRequest("An invoice needs at least one line item");

  const settings = await loadClinicSettings(clinicId);
  const invoiceId = await insertInvoice({
    clinicId,
    patientId: body.patientId,
    appointmentId: body.appointmentId ?? null,
    invoicePrefix: settings.invoicePrefix,
    discount: body.discount ?? 0,
    taxPercent: settings.taxPercent,
    createdBy,
    items: body.items,
  });
  return getInvoice(clinicId, invoiceId);
}

export async function recordPayment(
  clinicId: string,
  invoiceId: string,
  receivedBy: string,
  amount: number,
  method: string,
) {
  const invoice = await findInvoiceById(clinicId, invoiceId);
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.Status === "Paid") throw ApiError.badRequest("Invoice is already fully paid");
  if (amount <= 0) throw ApiError.badRequest("Payment amount must be positive");

  const remaining = Number(invoice.Total) - Number(invoice.PaidAmount);
  if (amount - remaining > 0.001) {
    throw ApiError.badRequest(`Payment exceeds the outstanding balance of ${remaining.toFixed(2)}`);
  }

  await insertPayment(clinicId, invoiceId, amount, method, receivedBy);
  return getInvoice(clinicId, invoiceId);
}
