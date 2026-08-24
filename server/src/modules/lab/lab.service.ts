import { ApiError } from "../../utils/ApiError.js";
import type { AccessTokenPayload } from "../../types/auth.js";
import { findPatientByIdForClinic } from "../patients/patients.repository.js";
import {
  listTests,
  insertTest,
  listOrders,
  listBillableOrders,
  findOrder,
  insertOrder,
  setOrderStatus,
  saveResult,
  type LabOrderRow,
} from "./lab.repository.js";

export async function getTests(clinicId: string) {
  return (await listTests(clinicId)).map((t) => ({ labTestId: t.LabTestID, name: t.Name, category: t.Category, price: Number(t.Price), isActive: t.IsActive }));
}

export async function createTest(clinicId: string, name: string, category: string | null, price: number) {
  const t = await insertTest(clinicId, name, category, price);
  return { labTestId: t.LabTestID, name: t.Name, category: t.Category, price: Number(t.Price), isActive: t.IsActive };
}

function toOrderDto(o: LabOrderRow) {
  return {
    labOrderId: o.LabOrderID,
    patientId: o.PatientID,
    consultationId: o.ConsultationID,
    labTestId: o.LabTestID,
    orderedByUserId: o.OrderedByUserID,
    status: o.Status,
    orderedAt: o.OrderedAt,
    testName: o.TestName,
    patientName: o.PatientName,
    mrNo: o.MRNo,
    resultText: o.ResultText,
    reviewedAt: o.ReviewedAt,
  };
}

export async function getOrders(clinicId: string, patientId?: string, status?: string) {
  return (await listOrders(clinicId, patientId, status)).map(toOrderDto);
}

/**
 * Billing view of a patient's outstanding lab orders. The DTO carries only what reception needs
 * to raise an invoice line — test name, price, order status — and deliberately omits resultText
 * and reviewedAt, which `toOrderDto` exposes to clinical roles.
 */
export async function getBillableOrders(clinicId: string, patientId: string) {
  const patient = await findPatientByIdForClinic(clinicId, patientId);
  if (!patient) throw ApiError.notFound("Patient not found");
  return (await listBillableOrders(clinicId, patientId)).map((o) => ({
    labOrderId: o.LabOrderID,
    patientId: o.PatientID,
    labTestId: o.LabTestID,
    testName: o.TestName,
    price: Number(o.Price),
    status: o.Status,
    orderedAt: o.OrderedAt,
    mrNo: o.MRNo,
  }));
}

export async function orderTest(authUser: AccessTokenPayload, patientId: string, consultationId: string | null, labTestId: string) {
  const clinicId = authUser.clinicId as string;
  const patient = await findPatientByIdForClinic(clinicId, patientId);
  if (!patient) throw ApiError.notFound("Patient not found");
  const orderId = await insertOrder(clinicId, patientId, consultationId, labTestId, authUser.sub);
  const order = await findOrder(clinicId, orderId);
  return toOrderDto(order as LabOrderRow);
}

export async function updateOrderStatus(clinicId: string, orderId: string, status: string) {
  const order = await findOrder(clinicId, orderId);
  if (!order) throw ApiError.notFound("Lab order not found");
  await setOrderStatus(clinicId, orderId, status);
  return toOrderDto((await findOrder(clinicId, orderId)) as LabOrderRow);
}

export async function recordResult(clinicId: string, orderId: string, reviewedBy: string, resultText: string) {
  const order = await findOrder(clinicId, orderId);
  if (!order) throw ApiError.notFound("Lab order not found");
  await saveResult(orderId, resultText, reviewedBy);
  return toOrderDto((await findOrder(clinicId, orderId)) as LabOrderRow);
}
