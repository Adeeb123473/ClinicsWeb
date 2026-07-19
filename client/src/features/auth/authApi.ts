import { apiClient } from "../../api/axios";
import { ApiError, type ApiEnvelope } from "../../api/types";
import type { AuthUser } from "../../store/authStore";

export interface LoginPayload {
  username: string;
  password: string;
}

export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

/** Unwraps the `{ success, data, error }` envelope, throwing ApiError on failure. */
function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success || envelope.data === null) {
    throw new ApiError(envelope.error?.message ?? "Request failed", {
      code: envelope.error?.code,
    });
  }
  return envelope.data;
}

export async function login(payload: LoginPayload): Promise<SessionResponse> {
  const response = await apiClient.post<ApiEnvelope<SessionResponse>>(
    "/auth/login",
    payload,
  );
  return unwrap(response.data);
}

export async function refresh(): Promise<SessionResponse> {
  const response = await apiClient.post<ApiEnvelope<SessionResponse>>("/auth/refresh");
  return unwrap(response.data);
}

export async function logout(): Promise<void> {
  const response = await apiClient.post<ApiEnvelope<null>>("/auth/logout");
  if (!response.data.success) {
    throw new ApiError(response.data.error?.message ?? "Logout failed");
  }
}

export async function fetchMe(): Promise<MeResponse> {
  const response = await apiClient.get<ApiEnvelope<MeResponse>>("/auth/me");
  return unwrap(response.data);
}
