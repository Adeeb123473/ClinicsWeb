import { apiClient } from "./axios";
import { ApiError, type ApiEnvelope, type PaginationMeta } from "./types";

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success || envelope.data === null) {
    throw new ApiError(envelope.error?.message ?? "Request failed", { code: envelope.error?.code });
  }
  return envelope.data;
}

/** Extracts a friendly error message from an axios/ApiError for toasts. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object") {
    const axiosErr = err as { response?: { data?: ApiEnvelope<unknown> }; message?: string };
    const apiMsg = axiosErr.response?.data?.error?.message;
    if (apiMsg) return apiMsg;
    if (err instanceof ApiError) return err.message;
    if (axiosErr.message) return axiosErr.message;
  }
  return fallback;
}

/** Extracts the machine-readable error code (e.g. "PLAN_FEATURE_NOT_INCLUDED") from an axios/ApiError. */
export function errorCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const axiosErr = err as { response?: { data?: ApiEnvelope<unknown> } };
    const code = axiosErr.response?.data?.error?.code;
    if (code) return code;
    if (err instanceof ApiError) return err.code;
  }
  return undefined;
}

export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<ApiEnvelope<T>>(url, { params });
  return unwrap(res.data);
}

export async function apiGetWithMeta<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<{ data: T; meta: PaginationMeta }> {
  const res = await apiClient.get<ApiEnvelope<T>>(url, { params });
  const data = unwrap(res.data);
  return { data, meta: (res.data.meta as unknown as PaginationMeta) ?? { page: 1, limit: 20, total: 0 } };
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.post<ApiEnvelope<T>>(url, body);
  return unwrap(res.data);
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.put<ApiEnvelope<T>>(url, body);
  return unwrap(res.data);
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.patch<ApiEnvelope<T>>(url, body);
  return unwrap(res.data);
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await apiClient.delete<ApiEnvelope<T>>(url);
  return unwrap(res.data);
}

/** Downloads a file from an authenticated endpoint (e.g. CSV export) and triggers a save dialog. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await apiClient.get(url, { responseType: "blob" });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
