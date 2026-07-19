import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminAuditEntry } from "../../features/admin/adminApi";
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
  STATUS_CHANGE: "warning",
  ASSIGN_PLAN: "info",
  CLINIC_REGISTERED: "info",
};

export function AdminAuditLogPage() {
  const { data, isLoading } = useQuery({ queryKey: ["admin", "audit"], queryFn: adminApi.auditLog });

  const columns: Column<AdminAuditEntry>[] = [
    { key: "time", header: "Time", render: (r) => formatDateTime(r.timestamp) },
    { key: "user", header: "User", render: (r) => r.username ?? <span className="text-slate-400">system</span> },
    { key: "action", header: "Action", render: (r) => <Badge tone={actionTone[r.action] ?? "neutral"}>{r.action}</Badge> },
    { key: "entity", header: "Entity", render: (r) => r.entity },
    { key: "ip", header: "IP", render: (r) => <span className="font-mono text-xs text-slate-500">{r.ipAddress ?? "—"}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Platform Audit Log" subtitle="Logins and administrative actions — no clinical data" />
      <Table
        columns={columns}
        rows={data ?? []}
        rowKey={(r) => r.logId}
        isLoading={isLoading}
        emptyTitle="No audit entries yet"
      />
    </div>
  );
}
