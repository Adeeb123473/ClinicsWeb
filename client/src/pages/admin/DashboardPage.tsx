import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminApi } from "../../features/admin/adminApi";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { Card } from "../../components/Card";
import { CenterSpinner } from "../../components/Spinner";
import { ErrorState } from "../../components/ErrorState";
import { UsersIcon, ClockIcon, ActivityIcon, CreditCardIcon } from "../../components/icons";
import { formatCurrency, titleCase } from "../../utils/format";

const STATUS_COLORS: Record<string, string> = {
  Approved: "#10b981",
  Pending: "#f59e0b",
  Suspended: "#ef4444",
  Inactive: "#94a3b8",
};

export function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminApi.dashboard,
  });

  if (isLoading) return <CenterSpinner />;
  if (isError || !data)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Platform Dashboard" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );

  const { totals, clinicsByStatus, usersByRole, planRevenue } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Platform Dashboard" subtitle="System-wide metrics across all clinics" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Clinics" value={totals.totalClinics} icon={<UsersIcon className="h-5 w-5" />} />
        <StatCard
          label="Pending Approvals"
          value={totals.pendingApprovals}
          tone="warning"
          icon={<ClockIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Active Users"
          value={totals.activeUsers}
          tone="info"
          icon={<ActivityIcon className="h-5 w-5" />}
        />
        <StatCard
          label="Monthly Recurring Revenue"
          value={totals.mrr}
          prefix="Rs "
          tone="success"
          icon={<CreditCardIcon className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Clinics by Status</h3>
          {clinicsByStatus.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No clinics yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={clinicsByStatus} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {clinicsByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {clinicsByStatus.map((s) => (
              <span key={s.status} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? "#94a3b8" }} />
                {s.status} ({s.count})
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">MRR by Plan</h3>
          {planRevenue.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No plans yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={planRevenue}>
                <XAxis dataKey="planName" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="mrr" fill="#1f7f79" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Active Users by Role</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {usersByRole.map((r) => (
            <div key={r.role} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{r.count}</p>
              <p className="text-xs text-slate-500">{titleCase(r.role)}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
