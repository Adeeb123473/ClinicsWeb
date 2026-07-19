import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore, type AuthUser } from "../store/authStore";
import type { ApiEnvelope } from "./types";

interface RefreshResponse {
  accessToken: string;
  user: AuthUser;
}

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

/** Requests that must never trigger a refresh-and-retry cycle. */
const AUTH_BYPASS_PATHS = ["/auth/refresh", "/auth/login", "/auth/logout"];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Deduplicates concurrent refresh attempts: if several requests 401 at once,
 * only one `/auth/refresh` call is made and every caller awaits it.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<ApiEnvelope<RefreshResponse>>("/auth/refresh")
      .then((response) => {
        const payload = response.data.data;
        if (!payload || !payload.user) {
          throw new Error("Malformed refresh response");
        }
        useAuthStore.getState().setSession(payload.user, payload.accessToken);
        return payload.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const requestPath = originalRequest?.url ?? "";
    const isBypassed = AUTH_BYPASS_PATHS.some((path) => requestPath.includes(path));

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !isBypassed &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true;
      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      } catch {
        useAuthStore.getState().clearSession();
        if (typeof window !== "undefined") {
          window.location.assign("/login");
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);
