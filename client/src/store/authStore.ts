import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole =
  | "SUPER_ADMIN"
  | "CLINIC_ADMIN"
  | "DOCTOR"
  | "RECEPTIONIST"
  | "NURSE";

export interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  clinicId: string | null;
  mustChangePassword: boolean;
}

interface AuthState {
  /** The authenticated user. Persisted to localStorage. */
  user: AuthUser | null;
  /**
   * Short-lived JWT access token. Deliberately NOT persisted — it lives only
   * in memory and is re-obtained via a silent `/auth/refresh` call on app
   * bootstrap (the refresh token itself travels as an httpOnly cookie).
   */
  accessToken: string | null;
  setSession: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setSession: (user, accessToken) => set({ user, accessToken }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clearSession: () => set({ user: null, accessToken: null }),
    }),
    {
      name: "clinicos-auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
