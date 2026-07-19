import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
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
import { clinicAdminApi } from "../../features/clinicAdmin/clinicAdminApi";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { Card } from "../../components/Card";
import { CenterSpinner } from "../../components/Spinner";
import { ErrorState } from "../../components/ErrorState";
import { CalendarIcon, UserPlusIcon, CreditCardIcon, ClipboardIcon } from "../../components/icons";
import { formatCurrency } from "../../utils/format";

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "#3b82f6",
  CheckedIn: "#f59e0b",
  InConsultation: "#8b5cf6",
  Completed: "#10b981",
  Cancelled: "#94a3b8",
  NoShow: "#ef4444",
};

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["clinic", "dashboard"], queryFn: clinicAdminApi.dashboard });

  if (isLoading) return <CenterSpinner />;
  if (isError || !data)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Dashboard" />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );

  const { summary, appointmentTrend, doctorLoad, statusMix } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" subtitle="Today at your clinic" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Appointments Today" value={summary.appointmentsToday} icon={<CalendarIcon className="h-5 w-5" />} />
        <StatCard label="New Patients Today" value={summary.newPatientsToday} tone="info" icon={<UserPlusIcon className="h-5 w-5" />} />
        <StatCard label="Revenue Today" value={summary.revenueToday} prefix="Rs " tone="success" icon={<CreditCardIcon className="h-5 w-5" />} />
        <StatCard label="Active Patients" value={summary.activePatients} tone="warning" icon={<ClipboardIcon className="h-5 w-5" />} />
      </div>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Appointments — last 14 days</h3>
        {appointmentTrend.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No appointment data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={appointmentTrend}>
              <defs>
                <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f7f79" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1f7f79" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#1f7f79" strokeWidth={2} fill="url(#apptGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Doctor workload (30 days)</h3>
          {doctorLoad.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={doctorLoad} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis type="category" dataKey="doctor" tick={{ fontSize: 11 }} stroke="#94a3b8" width={110} />
                <Tooltip />
                <Bar dataKey="count" fill="#2a9d94" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Appointment status mix (30 days)</h3>
          {statusMix.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={statusMix} dataKey="count" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {statusMix.map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                {statusMix.map((s) => (
                  <span key={s.status} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[s.status] ?? "#94a3b8" }} />
                    {s.status} ({s.count})
                  </span>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Revenue this month</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{formatCurrency(summary.revenueMonth)}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success-50 text-success-600">
          <CreditCardIcon className="h-5 w-5" />
        </div>
      </Card>
    </div>
  );
}
