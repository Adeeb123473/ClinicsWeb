import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { clinicApi, type Appointment } from "../../features/clinic/clinicApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { HeartPulseIcon } from "../../components/icons";
import { formatTime } from "../../utils/format";

const statusTone: Record<string, "info" | "warning" | "primary" | "success" | "danger" | "neutral"> = {
  Scheduled: "info",
  CheckedIn: "warning",
  InConsultation: "primary",
  Completed: "success",
  Cancelled: "neutral",
  NoShow: "danger",
};

export function TodayPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useQuery({ queryKey: ["queue", today], queryFn: () => clinicApi.getQueue({ date: today }), refetchInterval: 20000 });

  const columns: Column<Appointment>[] = [
    { key: "token", header: "Token", render: (a) => <span className="font-semibold text-primary-700">{a.tokenNo}</span> },
    { key: "time", header: "Time", render: (a) => formatTime(a.appointmentTime) },
    {
      key: "patient",
      header: "Patient",
      render: (a) => (
        <div>
          <p className="font-medium text-slate-800">{a.patientName}</p>
          <p className="text-xs text-slate-400">{a.mrNo} · {a.gender}</p>
        </div>
      ),
    },
    { key: "doctor", header: "Doctor", render: (a) => a.doctorName },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge> },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: () => (
        <Button size="sm" variant="secondary" onClick={() => navigate("/app/vitals")}>
          <HeartPulseIcon className="h-4 w-4" /> Vitals
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Today" subtitle="Today's appointments — record vitals before consultation" />
      <Table columns={columns} rows={data ?? []} rowKey={(a) => a.appointmentId} isLoading={isLoading} emptyTitle="No appointments today" />
    </div>
  );
}
