import { useQuery } from "@tanstack/react-query";
import { clinicAdminApi, type AuditEntry } from "../../features/clinicAdmin/clinicAdminApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { formatDateTime } from "../../utils/format";

const actionTone: Record<string, "success" | "danger" | "warning" | "info" | "neutral"> = {
  LOGIN_SUCCESS: "success",
  LOGIN_FAILED: "danger",
  LOGOUT: "neutral",
  CREATE: "info",
  UPDATE: "warning",
  DELETE: "danger",
  READ: "neutral",
  RESET_PASSWORD: "warning",
};

export function ClinicAuditLogPage() {
  const { data, isLoading } = useQuery({ queryKey: ["clinic", "audit"], queryFn: clinicAdminApi.auditLog });

  const columns: Column<AuditEntry>[] = [
    { key: "time", header: "Time", render: (r) => formatDateTime(r.timestamp) },
    { key: "user", header: "User", render: (r) => r.username ?? <span className="text-slate-400">system</span> },
    { key: "action", header: "Action", render: (r) => <Badge tone={actionTone[r.action] ?? "neutral"}>{r.action}</Badge> },
    { key: "entity", header: "Entity", render: (r) => r.entity },
    { key: "ip", header: "IP", render: (r) => <span className="font-mono text-xs text-slate-500">{r.ipAddress ?? "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit Log" subtitle="Every action taken within your clinic" />
      <Table columns={columns} rows={data ?? []} rowKey={(r) => r.logId} isLoading={isLoading} emptyTitle="No audit entries yet" />
    </div>
  );
}
