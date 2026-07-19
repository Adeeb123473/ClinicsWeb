import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { clinicAdminApi } from "../../features/clinicAdmin/clinicAdminApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { CenterSpinner } from "../../components/Spinner";
import { PlanUpgradeNotice } from "../../components/PlanUpgradeNotice";
import { DownloadIcon } from "../../components/icons";
import { downloadFile, errorMessage, errorCode } from "../../api/http";
import { toast } from "../../store/toastStore";
import { formatCurrency } from "../../utils/format";

export function ReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const dashboard = useQuery({ queryKey: ["clinic", "dashboard"], queryFn: clinicAdminApi.dashboard });
  const revenue = useQuery({ queryKey: ["clinic", "revenue", 30], queryFn: () => clinicAdminApi.revenue(30) });

  const doExport = async (path: string, filename: string) => {
    setExporting(filename);
    try {
      await downloadFile(`/reports/export/${path}`, filename);
      toast.success(`${filename} downloaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(null);
    }
  };

  if (dashboard.isLoading) return <CenterSpinner />;

  if (dashboard.isError && errorCode(dashboard.error) === "PLAN_FEATURE_NOT_INCLUDED") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reports" subtitle="Trends and exports for your clinic" />
        <PlanUpgradeNotice message={errorMessage(dashboard.error)} />
      </div>
    );
  }

  const trend = dashboard.data?.appointmentTrend ?? [];
  const rev = revenue.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        subtitle="Trends and exports for your clinic"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" isLoading={exporting === "patients.csv"} onClick={() => doExport("patients", "patients.csv")}>
              <DownloadIcon className="h-4 w-4" /> Patients CSV
            </Button>
            <Button variant="secondary" isLoading={exporting === "appointments.csv"} onClick={() => doExport("appointments", "appointments.csv")}>
              <DownloadIcon className="h-4 w-4" /> Appointments CSV
            </Button>
          </div>
        }
      />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Appointment volume — 14 days</h3>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#1f7f79" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Revenue — 30 days</h3>
        {rev.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No payments recorded yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rev}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
