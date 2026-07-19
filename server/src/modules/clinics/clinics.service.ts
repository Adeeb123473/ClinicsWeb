import { ApiError } from "../../utils/ApiError.js";
import { findPlanById } from "../plans/plans.repository.js";
import {
  listClinics,
  findClinicById,
  updateClinicStatus,
  assignPlan,
  type ClinicListRow,
  type ClinicRow,
  type ClinicStatus,
  type ListClinicsParams,
} from "./clinics.repository.js";

export interface ClinicDto {
  clinicId: string;
  clinicName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: ClinicStatus;
  timeZone: string;
  planId: string | null;
  planName: string | null;
  subscriptionExpiry: Date | null;
  userCount: number;
  createdDate: Date;
}

function toDto(row: ClinicListRow): ClinicDto {
  return {
    clinicId: row.ClinicID,
    clinicName: row.ClinicName,
    address: row.Address,
    phone: row.Phone,
    email: row.Email,
    status: row.Status,
    timeZone: row.TimeZone,
    planId: row.SubscriptionPlanID,
    planName: row.PlanName,
    subscriptionExpiry: row.SubscriptionExpiry,
    userCount: row.UserCount,
    createdDate: row.CreatedDate,
  };
}

export async function getClinics(
  params: ListClinicsParams,
): Promise<{ clinics: ClinicDto[]; total: number }> {
  const { rows, total } = await listClinics(params);
  return { clinics: rows.map(toDto), total };
}

export async function getClinic(clinicId: string): Promise<ClinicDto> {
  const row = await findClinicById(clinicId);
  if (!row) throw ApiError.notFound("Clinic not found");
  return toDto(row);
}

/** Maps an admin action verb to the target clinic status. */
const ACTION_STATUS: Record<string, ClinicStatus> = {
  approve: "Approved",
  reject: "Inactive",
  suspend: "Suspended",
  reactivate: "Approved",
};

export async function changeClinicStatus(
  clinicId: string,
  action: keyof typeof ACTION_STATUS,
): Promise<ClinicDto> {
  const existing = await findClinicById(clinicId);
  if (!existing) throw ApiError.notFound("Clinic not found");

  const target = ACTION_STATUS[action];
  if (!target) throw ApiError.badRequest("Unknown clinic action");

  const updated = (await updateClinicStatus(clinicId, target)) as ClinicRow;
  const refreshed = await findClinicById(updated.ClinicID);
  return toDto(refreshed as ClinicListRow);
}

export async function setClinicPlan(
  clinicId: string,
  planId: string,
  expiry: Date | null,
): Promise<ClinicDto> {
  const clinic = await findClinicById(clinicId);
  if (!clinic) throw ApiError.notFound("Clinic not found");

  const plan = await findPlanById(planId);
  if (!plan) throw ApiError.badRequest("Plan not found");

  await assignPlan(clinicId, planId, expiry);
  const refreshed = await findClinicById(clinicId);
  return toDto(refreshed as ClinicListRow);
}
