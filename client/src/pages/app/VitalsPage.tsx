import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicApi, type Patient } from "../../features/clinic/clinicApi";
import { clinicalApi } from "../../features/clinical/clinicalApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { SearchIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { formatDateTime } from "../../utils/format";
import { cn } from "../../utils/cn";

/** Simple abnormal-range checks for highlighting. */
function isAbnormal(field: string, value: number): boolean {
  switch (field) {
    case "bpSystolic": return value > 140 || value < 90;
    case "bpDiastolic": return value > 90 || value < 60;
    case "pulseRate": return value > 100 || value < 60;
    case "temperature": return value > 37.5 || value < 35;
    case "spO2": return value < 94;
    case "bloodSugar": return value > 200 || value < 70;
    case "bmi": return value >= 30 || value < 18.5;
    default: return false;
  }
}

export function VitalsPage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");

  const searchQuery = useQuery({
    queryKey: ["patients", "vitals-search", search],
    queryFn: () => clinicApi.searchPatients(search, 1, 8),
    enabled: !patient && search.length > 1,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vitals" subtitle="Record patient vitals before consultation" />

      {!patient ? (
        <Card>
          <div className="relative max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Search patient by name, MR No, mobile" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {searchQuery.data && searchQuery.data.data.length > 0 && (
            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
              {searchQuery.data.data.map((p) => (
                <button key={p.PatientID} type="button" onClick={() => setPatient(p)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                  <span className="font-medium text-slate-700">{p.PatientName}</span>
                  <span className="text-xs text-slate-400">{p.MRNo} · {p.MobileNo ?? "—"}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <VitalsEntry patient={patient} onChangePatient={() => setPatient(null)} />
      )}
    </div>
  );
}

const FIELDS: { key: string; label: string; unit: string; step?: string }[] = [
  { key: "bpSystolic", label: "BP Systolic", unit: "mmHg" },
  { key: "bpDiastolic", label: "BP Diastolic", unit: "mmHg" },
  { key: "pulseRate", label: "Pulse", unit: "bpm" },
  { key: "temperature", label: "Temperature", unit: "°C", step: "0.1" },
  { key: "weight", label: "Weight", unit: "kg", step: "0.1" },
  { key: "height", label: "Height", unit: "cm", step: "0.1" },
  { key: "spO2", label: "SpO₂", unit: "%" },
  { key: "bloodSugar", label: "Blood Sugar", unit: "mg/dL", step: "0.1" },
];

function VitalsEntry({ patient, onChangePatient }: { patient: Patient; onChangePatient: () => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const history = useQuery({ queryKey: ["vitals", patient.PatientID], queryFn: () => clinicalApi.listVitals(patient.PatientID) });

  const bmi = useMemo(() => {
    const w = parseFloat(values.weight);
    const h = parseFloat(values.height);
    if (!w || !h) return null;
    return Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
  }, [values.weight, values.height]);

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { patientId: patient.PatientID };
      for (const f of FIELDS) if (values[f.key]) body[f.key] = Number(values[f.key]);
      return clinicalApi.recordVitals(body);
    },
    onSuccess: () => {
      toast.success("Vitals recorded");
      setValues({});
      queryClient.invalidateQueries({ queryKey: ["vitals", patient.PatientID] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">{patient.PatientName}</p>
          <p className="text-sm text-slate-500">
            {patient.MRNo} · {patient.Gender} · {patient.currentAge ? `${patient.currentAge.value} ${patient.currentAge.unit}` : "—"}
          </p>
        </div>
        <Button variant="ghost" onClick={onChangePatient}>Change patient</Button>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Record vitals</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {FIELDS.map((f) => {
            const num = parseFloat(values[f.key]);
            const abnormal = !Number.isNaN(num) && isAbnormal(f.key, num);
            return (
              <div key={f.key}>
                <Input
                  label={`${f.label} (${f.unit})`}
                  type="number"
                  step={f.step}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className={cn(abnormal && "border-danger-400 text-danger-700")}
                />
                {abnormal && <p className="mt-1 text-xs font-medium text-danger-600">Out of normal range</p>}
              </div>
            );
          })}
          <div>
            <label className="text-sm font-medium text-slate-700">BMI (auto)</label>
            <div
              className={cn(
                "mt-1.5 flex h-10 items-center rounded-xl border px-3 text-sm",
                bmi === null ? "border-slate-200 text-slate-400" : isAbnormal("bmi", bmi) ? "border-danger-400 bg-danger-50 text-danger-700" : "border-success-300 bg-success-50 text-success-700",
              )}
            >
              {bmi ?? "—"}
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}>Save vitals</Button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Recent vitals</h3>
        {history.data && history.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="py-2">When</th><th>BP</th><th>Pulse</th><th>Temp</th><th>BMI</th><th>SpO₂</th><th>Sugar</th><th>By</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((v) => (
                  <tr key={v.vitalId} className="border-t border-slate-50 text-slate-700">
                    <td className="py-2">{formatDateTime(v.recordedAt)}</td>
                    <td>{v.bpSystolic ?? "—"}/{v.bpDiastolic ?? "—"}</td>
                    <td>{v.pulseRate ?? "—"}</td>
                    <td>{v.temperature ?? "—"}</td>
                    <td>{v.bmi !== null && isAbnormal("bmi", v.bmi) ? <Badge tone="danger">{v.bmi}</Badge> : v.bmi ?? "—"}</td>
                    <td>{v.spO2 ?? "—"}</td>
                    <td>{v.bloodSugar ?? "—"}</td>
                    <td className="text-xs text-slate-400">{v.recordedByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-slate-400">No vitals recorded yet</p>
        )}
      </Card>
    </div>
  );
}
