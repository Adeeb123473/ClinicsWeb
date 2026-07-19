import { ApiError } from "../../utils/ApiError.js";
import {
  listPlans,
  listActivePlans,
  findPlanById,
  insertPlan,
  updatePlan,
  deletePlan,
  countClinicsOnPlan,
  type PlanRow,
  type PlanInput,
} from "./plans.repository.js";

export interface PlanDto {
  planId: string;
  name: string;
  priceMonthly: number;
  maxUsers: number | null;
  maxPatients: number | null;
  features: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function parseFeatures(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toDto(row: PlanRow): PlanDto {
  return {
    planId: row.PlanID,
    name: row.Name,
    priceMonthly: Number(row.PriceMonthly),
    maxUsers: row.MaxUsers,
    maxPatients: row.MaxPatients,
    features: parseFeatures(row.Features),
    isActive: row.IsActive,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

export async function getPlans(): Promise<PlanDto[]> {
  return (await listPlans()).map(toDto);
}

export async function getPublicPlans(): Promise<PlanDto[]> {
  return (await listActivePlans()).map(toDto);
}

export async function getPlan(planId: string): Promise<PlanDto> {
  const row = await findPlanById(planId);
  if (!row) throw ApiError.notFound("Plan not found");
  return toDto(row);
}

export async function createPlan(input: PlanInput): Promise<PlanDto> {
  return toDto(await insertPlan(input));
}

export async function editPlan(planId: string, input: PlanInput): Promise<PlanDto> {
  const row = await updatePlan(planId, input);
  if (!row) throw ApiError.notFound("Plan not found");
  return toDto(row);
}

export async function removePlan(planId: string): Promise<void> {
  const existing = await findPlanById(planId);
  if (!existing) throw ApiError.notFound("Plan not found");

  const inUse = await countClinicsOnPlan(planId);
  if (inUse > 0) {
    throw ApiError.conflict(
      `Cannot delete a plan assigned to ${inUse} clinic(s). Deactivate it instead.`,
      "PLAN_IN_USE",
    );
  }
  await deletePlan(planId);
}
