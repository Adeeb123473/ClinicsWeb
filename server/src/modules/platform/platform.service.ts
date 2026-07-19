import { readSettings, writeSettings } from "./platform.repository.js";

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  allowClinicRegistration: boolean;
  maintenanceMode: boolean;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: "ClinicOS",
  supportEmail: "support@clinicos.local",
  allowClinicRegistration: true,
  maintenanceMode: false,
};

function parse(raw: string | null): PlatformSettings {
  if (!raw) return DEFAULT_PLATFORM_SETTINGS;
  try {
    return { ...DEFAULT_PLATFORM_SETTINGS, ...(JSON.parse(raw) as object) } as PlatformSettings;
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return parse(await readSettings());
}

export async function savePlatformSettings(input: Partial<PlatformSettings>, updatedBy: string | null): Promise<PlatformSettings> {
  const merged = { ...parse(await readSettings()), ...input };
  await writeSettings(JSON.stringify(merged), updatedBy);
  return merged;
}
