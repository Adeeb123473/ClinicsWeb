import { ApiError } from "../../utils/ApiError.js";
import {
  readSettings,
  writeSettings,
  listAnnouncements,
  listActiveAnnouncements,
  insertAnnouncement,
  setAnnouncementActive,
  deleteAnnouncement,
  type AnnouncementRow,
} from "./platform.repository.js";

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

function toAnnouncementDto(a: AnnouncementRow) {
  return {
    announcementId: a.AnnouncementID,
    title: a.Title,
    body: a.Body,
    level: a.Level,
    isActive: a.IsActive,
    startsAt: a.StartsAt,
    endsAt: a.EndsAt,
    createdAt: a.CreatedAt,
  };
}

export async function getAnnouncements() {
  return (await listAnnouncements()).map(toAnnouncementDto);
}

export async function getActiveAnnouncements() {
  return (await listActiveAnnouncements()).map(toAnnouncementDto);
}

export interface AnnouncementInput {
  title: string;
  body?: string | null;
  level: string;
  startsAt?: string | null;
  endsAt?: string | null;
}

export async function createAnnouncement(input: AnnouncementInput, createdBy: string | null) {
  const a = await insertAnnouncement(
    input.title,
    input.body ?? null,
    input.level,
    input.startsAt ? new Date(input.startsAt) : null,
    input.endsAt ? new Date(input.endsAt) : null,
    createdBy,
  );
  return toAnnouncementDto(a);
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const a = await setAnnouncementActive(id, isActive);
  if (!a) throw ApiError.notFound("Announcement not found");
  return toAnnouncementDto(a);
}

export async function removeAnnouncement(id: string) {
  await deleteAnnouncement(id);
}
