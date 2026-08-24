import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicApi, type Patient, type Appointment } from "../../features/clinic/clinicApi";
import { clinicalApi, type PrescriptionItem, type PatientHistory, type Consultation } from "../../features/clinical/clinicalApi";
import { PrescriptionBuilder } from "../../features/clinical/PrescriptionBuilder";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { CenterSpinner } from "../../components/Spinner";
import { AlertIcon, PrintIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { useAuthStore } from "../../store/authStore";
import { formatDate } from "../../utils/format";
import { printHtml, prescriptionHtml } from "../../utils/print";
import { letterheadApi } from "../../features/letterhead/letterheadApi";
import { printTemplate } from "../../features/letterhead/printTemplate";
import { LetterheadSetupModal } from "../../features/letterhead/LetterheadSetupModal";

export function ConsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();

  const apptQuery = useQuery({ queryKey: ["appointment", appointmentId], queryFn: () => clinicApi.getAppointment(appointmentId!), enabled: !!appointmentId });
  const patientId = apptQuery.data?.patientId;
  const patientQuery = useQuery({ queryKey: ["patient", patientId], queryFn: () => clinicApi.getPatient(patientId!), enabled: !!patientId });
  const historyQuery = useQuery({ queryKey: ["history", patientId], queryFn: () => clinicalApi.history(patientId!), enabled: !!patientId });
  const existingQuery = useQuery({ queryKey: ["consult-appt", appointmentId], queryFn: () => clinicalApi.getConsultationForAppointment(appointmentId!), enabled: !!appointmentId });
  const rxQuery = useQuery({
    queryKey: ["rx", existingQuery.data?.ConsultationID],
    queryFn: () => clinicalApi.getPrescription(existingQuery.data!.ConsultationID),
    enabled: !!existingQuery.data?.ConsultationID,
  });

  const loading =
    apptQuery.isLoading || patientQuery.isLoading || existingQuery.isLoading || (!!existingQuery.data?.ConsultationID && rxQuery.isLoading);

  if (loading) return <CenterSpinner />;
  if (!apptQuery.data || !patientQuery.data) return <p className="text-slate-500">Appointment not found.</p>;

  return (
    <ConsultationEditor
      appointment={apptQuery.data}
      patient={patientQuery.data}
      history={historyQuery.data}
      existing={existingQuery.data ?? null}
      initialItems={rxQuery.data?.items ?? []}
    />
  );
}

interface ConsultForm {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  examinationNotes: string;
  diagnosis: string;
  icd10Code: string;
  treatmentPlan: string;
  followUpDate: string;
}

function ConsultationEditor({
  appointment,
  patient,
  history,
  existing,
  initialItems,
}: {
  appointment: Appointment;
  patient: Patient;
  history?: PatientHistory;
  existing: Consultation | null;
  initialItems: PrescriptionItem[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const doctorName = useAuthStore((s) => s.user?.fullName) ?? "Doctor";

  const [form, setForm] = useState<ConsultForm>({
    chiefComplaint: existing?.ChiefComplaint ?? "",
    historyOfPresentIllness: existing?.HistoryOfPresentIllness ?? "",
    examinationNotes: existing?.ExaminationNotes ?? "",
    diagnosis: existing?.Diagnosis ?? "",
    icd10Code: existing?.ICD10Code ?? "",
    treatmentPlan: existing?.TreatmentPlan ?? "",
    followUpDate: existing?.FollowUpDate ? existing.FollowUpDate.slice(0, 10) : "",
  });
  const [items, setItems] = useState<PrescriptionItem[]>(initialItems);
  const [saving, setSaving] = useState(false);

  const templatesQuery = useQuery({ queryKey: ["rx-templates"], queryFn: clinicalApi.listTemplates });

  // The treating doctor's letterhead, if they have set one up. Printing falls back to the
  // built-in prescription layout when there is none, so this never blocks a consultation.
  const letterheadQuery = useQuery({
    queryKey: ["letterhead", appointment.doctorId],
    queryFn: () => letterheadApi.get(appointment.doctorId),
  });
  const letterhead = letterheadQuery.data;
  const [editingLetterhead, setEditingLetterhead] = useState(false);
  const set = (patch: Partial<ConsultForm>) => setForm({ ...form, ...patch });

  const persist = async (): Promise<void> => {
    const c = await clinicalApi.saveConsultation({
      appointmentId: appointment.appointmentId,
      chiefComplaint: form.chiefComplaint || null,
      historyOfPresentIllness: form.historyOfPresentIllness || null,
      examinationNotes: form.examinationNotes || null,
      diagnosis: form.diagnosis || null,
      icd10Code: form.icd10Code || null,
      treatmentPlan: form.treatmentPlan || null,
      followUpDate: form.followUpDate || null,
    });
    await clinicalApi.savePrescription(c.ConsultationID, items.filter((it) => it.medicineName.trim()));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await persist();
      toast.success("Consultation saved");
      queryClient.invalidateQueries({ queryKey: ["history", patient.PatientID] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await persist();
      await clinicApi.setStatus(appointment.appointmentId, "Completed").catch(() => undefined);
      toast.success("Consultation completed");
      // Awaited: printing now fetches and inlines the letterhead image first, so letting this
      // float would race the navigation that follows and could print before the image resolves.
      await printPrescription();
      queryClient.invalidateQueries({ queryKey: ["queue"] });
      navigate("/app");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const printPrescription = async () => {
    const age = patient.currentAge ? `${patient.currentAge.value} ${patient.currentAge.unit}` : "—";

    // Prefer the doctor's own letterhead when one is configured. A DRAFT template still prints
    // — the warning banner tells them it is uncalibrated — because refusing to print would be
    // worse than printing something slightly misaligned.
    if (letterhead?.letterheadImageUrl) {
      const body = [
        form.diagnosis ? `Diagnosis: ${form.diagnosis}` : "",
        ...items
          .filter((it) => it.medicineName.trim())
          .map((it) => `${it.medicineName} — ${[it.dosage, it.frequency, it.durationDays ? `${it.durationDays} days` : ""].filter(Boolean).join(", ")}`),
        form.followUpDate ? `Follow-up: ${formatDate(form.followUpDate)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const result = await printTemplate(
        letterhead,
        {
          patientName: patient.PatientName,
          age,
          gender: patient.Gender,
          date: formatDate(new Date()),
          mrNo: patient.MRNo,
          doctorName,
          consultationBody: body,
        },
        `Prescription ${patient.MRNo}`,
      );
      if (!result.ok) {
        toast.error("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      }
      return;
    }

    printHtml(
      `Prescription ${patient.MRNo}`,
      prescriptionHtml({
        header: "",
        footer: "",
        doctorName,
        patientName: patient.PatientName,
        mrNo: patient.MRNo,
        age,
        gender: patient.Gender,
        date: formatDate(new Date()),
        diagnosis: form.diagnosis || null,
        items: items.filter((it) => it.medicineName.trim()),
        followUpDate: form.followUpDate || null,
      }),
      148,
    );
  };

  const todaysVitals = history?.vitals[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consultation"
        subtitle={`${patient.PatientName} · ${patient.MRNo} · Token ${appointment.tokenNo}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={printPrescription}>
              <PrintIcon className="h-4 w-4" /> Print Rx
            </Button>
            <Button variant="secondary" isLoading={saving} disabled={!form.examinationNotes.trim()} onClick={handleSave}>
              Save
            </Button>
            <Button isLoading={saving} disabled={!form.examinationNotes.trim()} onClick={handleFinish}>
              Finish &amp; print
            </Button>
          </div>
        }
      />

      {letterhead && letterhead.status === "DRAFT" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-200 bg-warning-50 p-3">
          <p className="text-sm text-warning-800">
            This doctor’s letterhead has not been calibrated with a test print, so printed text may not line up with
            the pad.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setEditingLetterhead(true)}>
            Set up letterhead
          </Button>
        </div>
      )}

      {editingLetterhead && (
        <LetterheadSetupModal
          doctorId={appointment.doctorId}
          doctorName={doctorName}
          onClose={() => setEditingLetterhead(false)}
          onSaved={() => letterheadQuery.refetch()}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Patient</h3>
            <p className="font-medium text-slate-800">{patient.PatientName}</p>
            <p className="text-sm text-slate-500">
              {patient.Gender} · {patient.currentAge ? `${patient.currentAge.value} ${patient.currentAge.unit}` : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">{patient.MobileNo ?? "—"}</p>
            {patient.Allergies && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-danger-50 p-2.5 text-sm text-danger-700">
                <AlertIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>Allergies:</strong> {patient.Allergies}
                </span>
              </div>
            )}
            {patient.ChronicConditions && <p className="mt-2 text-xs text-slate-500"><strong>Chronic:</strong> {patient.ChronicConditions}</p>}
            {patient.BloodGroup && <Badge tone="neutral" className="mt-2">Blood {patient.BloodGroup}</Badge>}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Today's vitals</h3>
            {todaysVitals ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Vital label="BP" value={`${todaysVitals.bpSystolic ?? "—"}/${todaysVitals.bpDiastolic ?? "—"}`} />
                <Vital label="Pulse" value={todaysVitals.pulseRate} />
                <Vital label="Temp" value={todaysVitals.temperature} />
                <Vital label="BMI" value={todaysVitals.bmi} />
                <Vital label="SpO₂" value={todaysVitals.spO2} />
                <Vital label="Sugar" value={todaysVitals.bloodSugar} />
              </div>
            ) : (
              <p className="text-sm text-slate-400">No vitals recorded today</p>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Past visits</h3>
            {(history?.consultations.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">No previous consultations</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history!.consultations.slice(0, 6).map((c) => (
                  <div key={c.ConsultationID} className="rounded-lg border border-slate-100 p-2 text-sm">
                    <p className="text-xs text-slate-400">
                      {formatDate(c.CreatedAt)} · {c.DoctorName ?? ""}
                    </p>
                    <p className="text-slate-700">{c.Diagnosis ?? c.ChiefComplaint ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Previous prescriptions</h3>
            {(history?.prescriptions.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">No previous prescriptions</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history!.prescriptions.slice(0, 6).map((rx) => (
                  <div key={rx.prescriptionId} className="rounded-lg border border-slate-100 p-2 text-sm">
                    <p className="text-xs text-slate-400">
                      {formatDate(rx.createdAt)} · {rx.doctorName}
                    </p>
                    {rx.diagnosis && <p className="text-slate-700">{rx.diagnosis}</p>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {rx.items.map((it, i) => (
                        <Badge key={i} tone="neutral">
                          {it.medicineName}
                          {it.dosage ? ` · ${it.dosage}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Clinical notes</h3>
            <div className="flex flex-col gap-4">
              <Textarea label="Chief complaint" value={form.chiefComplaint} onChange={(e) => set({ chiefComplaint: e.target.value })} />
              <Textarea label="History of present illness" value={form.historyOfPresentIllness} onChange={(e) => set({ historyOfPresentIllness: e.target.value })} />
              <Textarea
                label="Examination notes (required)"
                value={form.examinationNotes}
                onChange={(e) => set({ examinationNotes: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input label="Diagnosis" className="sm:col-span-2" value={form.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} />
                <Input label="ICD-10" value={form.icd10Code} onChange={(e) => set({ icd10Code: e.target.value })} />
              </div>
              <Textarea label="Treatment plan" value={form.treatmentPlan} onChange={(e) => set({ treatmentPlan: e.target.value })} />
              <Input label="Follow-up date" type="date" value={form.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} className="w-48" />
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Prescription</h3>
            <PrescriptionBuilder
              items={items}
              onChange={setItems}
              templates={templatesQuery.data ?? []}
              onTemplatesChanged={() => queryClient.invalidateQueries({ queryKey: ["rx-templates"] })}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value ?? "—"}</p>
    </div>
  );
}
