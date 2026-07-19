import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Card } from "../../components/Card";
import { ApiError } from "../../api/types";
import { useLoginMutation } from "./useAuthMutations";
import { loginSchema, type LoginFormValues } from "./loginSchema";

export function LoginPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const loginMutation = useLoginMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { user: sessionUser } = await loginMutation.mutateAsync(values);
      navigate(sessionUser.role === "SUPER_ADMIN" ? "/admin" : "/app", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError("Invalid username or password");
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  });

  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4">
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-lg font-bold text-white shadow-soft-lg">
            C
          </div>
          <h1 className="text-xl font-semibold text-slate-900">ClinicOS</h1>
          <p className="text-sm text-slate-500">Sign in to manage your clinic</p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700"
              >
                {formError}
              </div>
            )}

            <Input
              label="Username"
              autoComplete="username"
              autoFocus
              error={errors.username?.message}
              {...register("username")}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" isLoading={loginMutation.isPending} className="mt-2 w-full">
              Sign in
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
