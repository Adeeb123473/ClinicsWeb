import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { clinicApi, type Appointment } from "../../features/clinic/clinicApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { StatCard } from "../../components/StatCard";
import { CenterSpinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { ClockIcon, CheckIcon, StethoscopeIcon } from "../../components/icons";
import { useAuthStore } from "../../store/authStore";
import { formatTime } from "../../utils/format";

const statusTone: Record<string, "info" | "warning" | "primary" | "success" | "danger" | "neutral"> = {
  Scheduled: "info",
  CheckedIn: "warning",
  InConsultation: "primary",
  Completed: "success",
  Cancelled: "neutral",
  NoShow: "danger",
};

export function MyDayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fullName = useAuthStore((s) => s.user?.fullName);
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["queue", today],
    queryFn: () => clinicApi.getQueue({ date: today }),
    refetchInterval: 20000,
  });

  const mine = useMemo(() => (data ?? []).filter((a) => a.doctorName === fullName), [data, fullName]);
  const waiting = mine.filter((a) => a.status === "CheckedIn").length;
  const done = mine.filter((a) => a.status === "Completed").length;

  const startConsultation = async (a: Appointment) => {
    if (a.status === "CheckedIn") {
      await clinicApi.setStatus(a.appointmentId, "InConsultation").catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    }
    navigate(`/app/consultation/${a.appointmentId}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Day" subtitle="Your patient queue for today" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total tokens" value={mine.length} icon={<ClockIcon className="h-5 w-5" />} />
        <StatCard label="Waiting" value={waiting} tone="warning" icon={<StethoscopeIcon className="h-5 w-5" />} />
        <StatCard label="Completed" value={done} tone="success" icon={<CheckIcon className="h-5 w-5" />} />
      </div>

      {isLoading ? (
        <CenterSpinner />
      ) : mine.length === 0 ? (
        <EmptyState title="No patients yet" description="Appointments booked for you today will appear here." />
      ) : (
        <div className="flex flex-col gap-2">
          {mine.map((a) => (
            <motion.div key={a.appointmentId} layout>
              <Card className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-xl font-bold text-primary-700">
                    {a.tokenNo}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{a.patientName}</p>
                    <p className="text-xs text-slate-400">
                      {a.mrNo} · {a.gender} · {formatTime(a.appointmentTime)} · {a.visitType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                  {["CheckedIn", "InConsultation"].includes(a.status) ? (
                    <Button size="sm" onClick={() => startConsultation(a)}>
                      {a.status === "InConsultation" ? "Resume" : "Start"} consultation
                    </Button>
                  ) : a.status === "Completed" ? (
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/app/consultation/${a.appointmentId}`)}>
                      View
                    </Button>
                  ) : null}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
