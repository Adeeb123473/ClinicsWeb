import { apiPut, apiPost, apiDelete } from "../../api/http";
import { apiClient } from "../../api/axios";
import type { ApiEnvelope } from "../../api/types";
import type { LetterheadField } from "./fields";

export interface ImageCalibration {
  imageWidthPx: number;
  imageHeightPx: number;
  mmPerPx: number;
}

export interface LetterheadTemplateDto {
  letterheadTemplateId: string;
  doctorId: string;
  doctorName: string;
  mode: "OVERLAY" | "FULL";
  paperSize: string;
  paperWidthMm: number;
  paperHeightMm: number;
  cornerPoints: { x: number; y: number }[] | null;
  imageCalibration: ImageCalibration | null;
  globalOffsetMm: { x: number; y: number };
  status: "DRAFT" | "CALIBRATED";
  fields: LetterheadField[];
  originalImageUrl: string | null;
  letterheadImageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SaveTemplateBody {
  mode: "OVERLAY" | "FULL";
  cornerPoints?: { x: number; y: number }[] | null;
  imageWidthPx?: number | null;
  imageHeightPx?: number | null;
  mmPerPx?: number | null;
  globalOffsetXMm?: number;
  globalOffsetYMm?: number;
  status?: "DRAFT" | "CALIBRATED";
  fields: LetterheadField[];
}

export const letterheadApi = {
  /**
   * "No letterhead yet" is a successful response carrying data: null, which the shared apiGet
   * helper treats as a failure. Unwrapped here instead so a doctor without a template reads as
   * null rather than throwing.
   */
  get: async (doctorId: string): Promise<LetterheadTemplateDto | null> => {
    const res = await apiClient.get<ApiEnvelope<LetterheadTemplateDto | null>>(
      `/doctors/${doctorId}/letterhead`,
    );
    return res.data.success ? (res.data.data ?? null) : null;
  },

  save: (doctorId: string, body: SaveTemplateBody) =>
    apiPut<LetterheadTemplateDto>(`/doctors/${doctorId}/letterhead`, body),

  uploadImage: (
    doctorId: string,
    kind: "ORIGINAL" | "DEWARPED",
    dataUrl: string,
    size?: { widthPx: number; heightPx: number },
  ) =>
    apiPost<LetterheadTemplateDto>(`/doctors/${doctorId}/letterhead/image`, {
      kind,
      dataUrl,
      widthPx: size?.widthPx,
      heightPx: size?.heightPx,
    }),

  remove: (doctorId: string) => apiDelete<{ deleted: boolean }>(`/doctors/${doctorId}/letterhead`),
};

/**
 * The stored images are served from an authenticated API route, so they cannot be used directly
 * as an <img src> from the app (the browser would send no Authorization header). Callers fetch
 * them through the axios instance and turn them into object URLs instead.
 */
export async function fetchImageObjectUrl(url: string): Promise<string> {
  // The API base already includes /api/v1, so strip it from the stored absolute path.
  const res = await apiClient.get(url.replace(/^\/api\/v1/, ""), { responseType: "blob" });
  return URL.createObjectURL(res.data as Blob);
}

/**
 * Fetches a stored letterhead image and inlines it as a base64 data URL.
 *
 * Required for printing. The print window is a separate document that cannot use the stored
 * API path directly: it would resolve against the app's own origin rather than the API's, and
 * even on the right origin an <img> tag sends no Authorization header, so the authenticated
 * endpoint returns 401 and the browser renders a broken-image placeholder. Inlining the bytes
 * sidesteps both problems and means the print window makes no network request at all.
 */
export async function fetchImageDataUrl(url: string): Promise<string> {
  const res = await apiClient.get(url.replace(/^\/api\/v1/, ""), { responseType: "blob" });
  const blob = res.data as Blob;
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the letterhead image"));
    reader.readAsDataURL(blob);
  });
}

/** True for a stored API path, as opposed to an already-inlined data:/blob: URL. */
export function needsInlining(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("/");
}
