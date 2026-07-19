/**
 * Shared API envelope types.
 *
 * Every backend endpoint responds with this shape (see CLAUDE.md section 6).
 * Query hooks should unwrap `.data` and throw `ApiError` on `success: false`.
 */

export interface ApiErrorPayload {
  message: string;
  code?: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
  meta?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** Thrown by the axios layer when `success` is false or a network/HTTP error occurs. */
export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = options?.code;
    this.status = options?.status;
  }
}
