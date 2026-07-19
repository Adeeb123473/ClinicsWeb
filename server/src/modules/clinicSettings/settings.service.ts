import { ApiError } from "../../utils/ApiError.js";
import { getClinicSettings, updateClinicSettings, type ClinicSettingsRow } from "./settings.repository.js";

/** The clinic-configurable settings blob (stored as JSON in Clinics.Settings). */
export interface ClinicSettings {
  mrNoFormat: string;
  tokenResetDaily: boolean;
  taxPercent: number;
  currency: string;
  prescriptionHeader: string;
  prescriptionFooter: string;
  invoicePrefix: string;
}

export const DEFAULT_SETTINGS: ClinicSettings = {
  mrNoFormat: "MR-{YYYY}-{seq}",
  tokenResetDaily: true,
  taxPercent: 0,
  currency: "PKR",
  prescriptionHeader: "",
  prescriptionFooter: "",
  invoicePrefix: "INV",
};

export interface OperatingHours {
  [day: string]: { open: string; close: string; closed: boolean };
}

const DEFAULT_HOURS: OperatingHours = {
  Monday: { open: "09:00", close: "17:00", closed: false },
  Tuesday: { open: "09:00", close: "17:00", closed: false },
  Wednesday: { open: "09:00", close: "17:00", closed: false },
  Thursday: { open: "09:00", close: "17:00", closed: false },
  Friday: { open: "09:00", close: "17:00", closed: false },
  Saturday: { open: "09:00", close: "13:00", closed: false },
  Sunday: { open: "09:00", close: "17:00", closed: true },
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export interface ClinicSettingsDto {
  clinicId: string;
  clinicName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  status: string;
  timeZone: string;
  operatingHours: OperatingHours;
  settings: ClinicSettings;
}

function toDto(row: ClinicSettingsRow): ClinicSettingsDto {
  return {
    clinicId: row.ClinicID,
    clinicName: row.ClinicName,
    address: row.Address,
    phone: row.Phone,
    email: row.Email,
    logoUrl: row.LogoUrl,
    status: row.Status,
    timeZone: row.TimeZone,
    operatingHours: parseJson<OperatingHours>(row.OperatingHours, DEFAULT_HOURS),
    settings: parseJson<ClinicSettings>(row.Settings, DEFAULT_SETTINGS),
  };
}

export async function getSettings(clinicId: string): Promise<ClinicSettingsDto> {
  const row = await getClinicSettings(clinicId);
  if (!row) throw ApiError.notFound("Clinic not found");
  return toDto(row);
}

/** Used by other modules (MR generation, billing, prescriptions) to read the merged settings blob. */
export async function loadClinicSettings(clinicId: string): Promise<ClinicSettings> {
  const row = await getClinicSettings(clinicId);
  return parseJson<ClinicSettings>(row?.Settings ?? null, DEFAULT_SETTINGS);
}

export interface UpdateSettingsInput {
  clinicName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timeZone: string;
  operatingHours: OperatingHours;
  settings: Partial<ClinicSettings>;
}

export async function saveSettings(clinicId: string, input: UpdateSettingsInput): Promise<ClinicSettingsDto> {
  const current = await getClinicSettings(clinicId);
  if (!current) throw ApiError.notFound("Clinic not found");

  const mergedSettings: ClinicSettings = { ...parseJson(current.Settings, DEFAULT_SETTINGS), ...input.settings };

  await updateClinicSettings(clinicId, {
    clinicName: input.clinicName,
    address: input.address,
    phone: input.phone,
    email: input.email,
    timeZone: input.timeZone,
    operatingHours: JSON.stringify(input.operatingHours),
    settings: JSON.stringify(mergedSettings),
  });

  return getSettings(clinicId);
}
