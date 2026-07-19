import { useMutation } from "@tanstack/react-query";
import { login, logout, type LoginPayload } from "./authApi";
import { useAuthStore } from "../../store/authStore";

export function useLoginMutation() {
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      setSession(data.user, data.accessToken);
    },
  });
}

export function useLogoutMutation() {
  const clearSession = useAuthStore((state) => state.clearSession);

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      // Clear the local session even if the server call fails — the user
      // should always be able to leave a signed-in state client-side.
      clearSession();
    },
  });
}
