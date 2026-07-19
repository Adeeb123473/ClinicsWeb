import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { clinicApi, type Patient } from "./clinicApi";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Textarea } from "../../components/Textarea";
import { Badge } from "../../components/Badge";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";

interface FormState {
  patientName: string;
  fatherHusbandName: string;
  gender: string;
  actualDOB: string;
  mobileNo: string;
  cnic: string;
  address: string;
  category: string;
  bloodGroup: string;
  allergies: string;
  chronicConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  remarks: string;
}

function toInitial(p?: Patient): FormState {
  return {
    patientName: p?.PatientName ?? "",
    fatherHusbandName: p?.FatherHusbandName ?? "",
    gender: p?.Gender ?? "Male",
    actualDOB: p?.ActualDOB ? p.ActualDOB.slice(0, 10) : "",
    mobileNo: p?.MobileNo ?? "",
    cnic: p?.CNIC ?? "",
    address: p?.Address ?? "",
    category: p?.Category ?? "General",
    bloodGroup: p?.BloodGroup ?? "",
    allergies: p?.Allergies ?? "",
    chronicConditions: p?.ChronicConditions ?? "",
    emergencyContactName: p?.EmergencyContactName ?? "",
    emergencyContactPhone: p?.EmergencyContactPhone ?? "",
    remarks: p?.Remarks ?? "",
  };
}

/** Registration + edit form with live CNIC/mobile duplicate detection (reception rule). */
export function PatientFormModal({
  patient,
  clinical,
  onClose,
  onSaved,
}: {
  patient?: Patient;
  /** Whether to show clinical fields (allergies/chronic) — hidden for receptionists. */
  clinical: boolean;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}) {
  const isEdit = Boolean(patient);
  const [form, setForm] = useState<FormState>(toInitial(patient));
  const [dupes, setDupes] = useState<{ mrNo: string; patientName: string; matchedOn: string[] }[]>([]);
  const [force, setForce] = useState(false);

  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });

  const runDupCheck = async () => {
    if (isEdit) return;
    if (!form.cnic && !form.mobileNo) return;
    try {
      const matches = await clinicApi.checkDuplicates(form.cnic || undefined, form.mobileNo || undefined);
      setDupes(matches);
    } catch {
      /* non-blocking */
    }
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        cnic: form.cnic || null,
        actualDOB: form.actualDOB || null,
        forceDuplicate: force,
      };
      return isEdit ? clinicApi.updatePatient(patient!.PatientID, payload) : clinicApi.registerPatient(payload);
    },
    onSuccess: (p) => {
      toast.success(isEdit ? "Patient updated" : `Registered — ${p.MRNo}`);
      onSaved(p);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit patient" : "Register patient"}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!form.patientName || !form.actualDOB}
            onClick={() => mutation.mutate()}
          >
            {isEdit ? "Save" : "Register"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {dupes.length > 0 && !force && (
          <div className="rounded-xl border border-warning-200 bg-warning-50 p-3">
            <p className="text-sm font-medium text-warning-700">Possible duplicate patient</p>
            <ul className="mt-1 space-y-0.5 text-sm text-warning-700">
              {dupes.map((d) => (
                <li key={d.mrNo}>
                  {d.patientName} ({d.mrNo}) — matched on {d.matchedOn.join(", ")}
                </li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-sm text-warning-700">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="h-4 w-4" />
              Register anyway (this is a different patient)
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Patient name" value={form.patientName} onChange={(e) => set({ patientName: e.target.value })} />
          <Input label="Father / Husband name" value={form.fatherHusbandName} onChange={(e) => set({ fatherHusbandName: e.target.value })} />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(e) => set({ gender: e.target.value })}
            options={[
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Other", label: "Other" },
            ]}
          />
          <Input label="Date of birth" type="date" value={form.actualDOB} onChange={(e) => set({ actualDOB: e.target.value })} />
          <Input
            label="Mobile"
            value={form.mobileNo}
            onChange={(e) => set({ mobileNo: e.target.value })}
            onBlur={runDupCheck}
          />
          <Input
            label="CNIC"
            value={form.cnic}
            onChange={(e) => set({ cnic: e.target.value })}
            onBlur={runDupCheck}
            hint="Format 35202-1234567-1"
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
            options={[
              { value: "General", label: "General" },
              { value: "Deserving", label: "Deserving" },
              { value: "Staff", label: "Staff" },
              { value: "Insurance", label: "Insurance" },
            ]}
          />
          <Input label="Blood group" value={form.bloodGroup} onChange={(e) => set({ bloodGroup: e.target.value })} />
        </div>

        <Input label="Address" value={form.address} onChange={(e) => set({ address: e.target.value })} />

        {clinical && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Textarea label="Allergies" value={form.allergies} onChange={(e) => set({ allergies: e.target.value })} />
            <Textarea label="Chronic conditions" value={form.chronicConditions} onChange={(e) => set({ chronicConditions: e.target.value })} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Emergency contact name" value={form.emergencyContactName} onChange={(e) => set({ emergencyContactName: e.target.value })} />
          <Input label="Emergency contact phone" value={form.emergencyContactPhone} onChange={(e) => set({ emergencyContactPhone: e.target.value })} />
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="neutral">{form.category}</Badge>
          <span className="text-xs text-slate-400">MR number is generated automatically on registration.</span>
        </div>
      </div>
    </Modal>
  );
}
