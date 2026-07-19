import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { registrationApi } from "../../features/registration/registrationApi";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { CheckIcon } from "../../components/icons";
import { errorMessage } from "../../api/http";

const schema = z.object({
  clinicName: z.string().min(2, "Clinic name is required"),
  clinicEmail: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
  adminFullName: z.string().min(2, "Your name is required"),
  adminUsername: z
    .string()
    .min(3, "At least 3 characters")
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, and . _ - only"),
  adminEmail: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[a-z]/, "Needs a lowercase letter")
    .regex(/[A-Z]/, "Needs an uppercase letter")
    .regex(/[0-9]/, "Needs a digit"),
});

type FormValues = z.infer<typeof schema>;

export function RegisterClinicPage() {
  const navigate = useNavigate();
  const [done, setDone] = useState<{ clinicName: string; username: string } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => registrationApi.register(values),
    onSuccess: (data) => setDone({ clinicName: data.clinicName, username: data.adminUsername }),
  });

  if (done) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-soft-lg"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-100 text-success-600">
            <CheckIcon className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">Registration submitted</h1>
          <p className="mt-2 text-sm text-slate-500">
            <strong>{done.clinicName}</strong> is now pending approval. Once a platform administrator approves your
            clinic, sign in as <strong>{done.username}</strong> to complete onboarding.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-8 shadow-soft-lg"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Register your clinic</h1>
          <p className="mt-1 text-sm text-slate-500">Create your clinic and administrator account. Approval takes just a moment.</p>
        </div>

        {mutation.isError && (
          <div className="mb-4 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{errorMessage(mutation.error)}</div>
        )}

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Clinic details</p>
          <Input label="Clinic name" {...register("clinicName")} error={errors.clinicName?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Clinic email" type="email" {...register("clinicEmail")} error={errors.clinicEmail?.message} />
            <Input label="Phone (optional)" {...register("phone")} error={errors.phone?.message} />
          </div>
          <Input label="Address (optional)" {...register("address")} error={errors.address?.message} />

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Administrator account</p>
          <Input label="Full name" {...register("adminFullName")} error={errors.adminFullName?.message} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Username" {...register("adminUsername")} error={errors.adminUsername?.message} />
            <Input label="Admin email" type="email" {...register("adminEmail")} error={errors.adminEmail?.message} />
          </div>
          <Input label="Password" type="password" {...register("password")} error={errors.password?.message} />

          <Button type="submit" size="lg" isLoading={mutation.isPending} className="mt-2">
            Create clinic
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
