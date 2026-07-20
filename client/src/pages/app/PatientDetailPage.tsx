import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { clinicApi } from "../../features/clinic/clinicApi";
import { clinicalApi } from "../../features/clinical/clinicalApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { CenterSpinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { AlertIcon, StethoscopeIcon, HeartPulseIcon, PillIcon } from "../../components/icons";
import { useAuthStore } from "../../store/authStore";
import { formatDate, formatDateTime } from "../../utils/format";

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const clinical = role !== "RECEPTIONIST";

  const patientQuery = useQuery({ queryKey: ["patient", id], queryFn: () => clinicApi.getPatient(id!), enabled: !!id });
  const historyQuery = useQuery({ queryKey: ["history", id], queryFn: () => clinicalApi.history(id!), enabled: !!id && clinical });

  if (patientQuery.isLoading) return <CenterSpinner />;
  if (!patientQuery.data) return <p className="text-slate-500">Patient not found.</p>;
  const p = patientQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={p.PatientName} subtitle={`${p.MRNo} · ${p.Gender} · ${p.currentAge ? `${p.currentAge.value} ${p.currentAge.unit}` : "—"}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Demographics</h3>
          <dl className="space-y-1.5 text-sm">
            <Row label="Father/Husband" value={p.FatherHusbandName} />
            <Row label="Mobile" value={p.MobileNo} />
            <Row label="CNIC" value={p.CNIC} />
            <Row label="Category" value={p.Category} />
            <Row label="Address" value={p.Address} />
            <Row label="Registered" value={formatDate(p.RegistrationDate)} />
          </dl>
          {clinical && p.Allergies && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-danger-50 p-2.5 text-sm text-danger-700">
              <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span><strong>Allergies:</strong> {p.Allergies}</span>
            </div>
          )}
          {clinical && p.ChronicConditions && <p className="mt-2 text-xs text-slate-500"><strong>Chronic:</strong> {p.ChronicConditions}</p>}
        </Card>

        <div className="lg:col-span-2">
          {!clinical ? (
            <EmptyState title="Clinical timeline hidden" description="Consultation history is not available to reception." />
          ) : historyQuery.isLoading ? (
            <CenterSpinner />
          ) : (
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-slate-800">Timeline</h3>
              <Timeline history={historyQuery.data} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ history }: { history?: Awaited<ReturnType<typeof clinicalApi.history>> }) {
  if (!history) return null;
  const events = [
    ...history.consultations.map((c) => ({ type: "consult" as const, date: c.CreatedAt ?? "", data: c })),
    ...history.prescriptions.map((rx) => ({ type: "prescription" as const, date: rx.createdAt, data: rx })),
    ...history.vitals.map((v) => ({ type: "vital" as const, date: v.recordedAt, data: v })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) return <EmptyState title="No history yet" description="Consultations and vitals will appear here." />;

  return (
    <div className="relative flex flex-col gap-4 before:absolute before:left-[15px] before:top-2 before:h-full before:w-px before:bg-slate-100">
      {events.map((e, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: i * 0.03 }}
          className="relative flex gap-4"
        >
          <div
            className={`z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
              e.type === "consult" ? "bg-primary-100 text-primary-700" : e.type === "prescription" ? "bg-warning-100 text-warning-700" : "bg-info-100 text-info-700"
            }`}
          >
            {e.type === "consult" ? (
              <StethoscopeIcon className="h-4 w-4" />
            ) : e.type === "prescription" ? (
              <PillIcon className="h-4 w-4" />
            ) : (
              <HeartPulseIcon className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 rounded-xl border border-slate-100 p-3">
            <p className="text-xs text-slate-400">{formatDateTime(e.date)}</p>
            {e.type === "consult" ? (
              <div className="mt-1">
                <p className="font-medium text-slate-800">{e.data.Diagnosis ?? e.data.ChiefComplaint ?? "Consultation"}</p>
                {e.data.DoctorName && <p className="text-xs text-slate-500">{e.data.DoctorName}</p>}
              </div>
            ) : e.type === "prescription" ? (
              <div className="mt-1">
                <p className="font-medium text-slate-800">Prescription · {e.data.doctorName}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {e.data.items.map((it, idx) => (
                    <Badge key={idx} tone="neutral">
                      {it.medicineName}
                      {it.dosage ? ` · ${it.dosage}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-600">
                {e.data.bpSystolic && <Badge tone="neutral">BP {e.data.bpSystolic}/{e.data.bpDiastolic}</Badge>}
                {e.data.pulseRate && <Badge tone="neutral">Pulse {e.data.pulseRate}</Badge>}
                {e.data.temperature && <Badge tone="neutral">Temp {e.data.temperature}</Badge>}
                {e.data.bmi && <Badge tone="neutral">BMI {e.data.bmi}</Badge>}
                {e.data.spO2 && <Badge tone="neutral">SpO₂ {e.data.spO2}</Badge>}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value || "—"}</dd>
    </div>
  );
}
