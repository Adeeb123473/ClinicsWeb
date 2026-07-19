import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clinicApi, type Patient, type Appointment } from "./clinicApi";
import { Modal } from "../../components/Modal";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Badge } from "../../components/Badge";
import { SearchIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { cn } from "../../utils/cn";

const VISIT_TYPES = [
  { value: "Private", label: "Private" },
  { value: "Deserving", label: "Deserving" },
  { value: "FollowUp", label: "Follow-up" },
  { value: "Emergency", label: "Emergency" },
  { value: "Insurance", label: "Insurance" },
];

export function BookAppointmentModal({
  date,
  presetPatient,
  onClose,
  onBooked,
}: {
  date: string;
  presetPatient?: Patient;
  onClose: () => void;
  onBooked: (a: Appointment) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(presetPatient ?? null);
  const [search, setSearch] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [time, setTime] = useState<string>("");
  const [visitType, setVisitType] = useState("Private");
  const [walkIn, setWalkIn] = useState(true);

  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: clinicApi.listDoctors });
  const searchQuery = useQuery({
    queryKey: ["patients", "book-search", search],
    queryFn: () => clinicApi.searchPatients(search, 1, 6),
    enabled: !patient && search.length > 1,
  });
  const slotsQuery = useQuery({
    queryKey: ["slots", doctorId, date],
    queryFn: () => clinicApi.getSlots(doctorId, date),
    enabled: Boolean(doctorId) && !walkIn,
  });

  const mutation = useMutation({
    mutationFn: () =>
      clinicApi.book({
        patientId: patient!.PatientID,
        doctorId,
        date,
        time: walkIn ? undefined : time || undefined,
        visitType,
      }),
    onSuccess: (a) => {
      toast.success(`Booked — token ${a.tokenNo}`);
      onBooked(a);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Book appointment"
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!patient || !doctorId || (!walkIn && !time)}
            onClick={() => mutation.mutate()}
          >
            Book & issue token
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {patient ? (
          <div className="flex items-center justify-between rounded-xl bg-primary-50 p-3">
            <div>
              <p className="font-medium text-slate-800">{patient.PatientName}</p>
              <p className="text-xs text-slate-500">
                {patient.MRNo} · {patient.MobileNo ?? "—"}
              </p>
            </div>
            {!presetPatient && (
              <Button size="sm" variant="ghost" onClick={() => setPatient(null)}>
                Change
              </Button>
            )}
          </div>
        ) : (
          <div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search patient by name / MR / mobile" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {searchQuery.data && searchQuery.data.data.length > 0 && (
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-100">
                {searchQuery.data.data.map((p) => (
                  <button
                    key={p.PatientID}
                    type="button"
                    onClick={() => setPatient(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{p.PatientName}</span>
                    <span className="text-xs text-slate-400">{p.MRNo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Select
          label="Doctor"
          value={doctorId}
          onChange={(e) => {
            setDoctorId(e.target.value);
            setTime("");
          }}
          placeholder="Select a doctor"
          options={(doctorsQuery.data ?? []).map((d) => ({
            value: d.doctorId,
            label: `${d.doctorName}${d.specialization ? ` — ${d.specialization}` : ""}`,
          }))}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWalkIn(true)}
            className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-medium", walkIn ? "border-primary-400 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-500")}
          >
            Walk-in (next token)
          </button>
          <button
            type="button"
            onClick={() => setWalkIn(false)}
            className={cn("flex-1 rounded-xl border px-3 py-2 text-sm font-medium", !walkIn ? "border-primary-400 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-500")}
          >
            Pick a slot
          </button>
        </div>

        {!walkIn && doctorId && (
          <div>
            {slotsQuery.isLoading ? (
              <p className="text-sm text-slate-400">Loading slots…</p>
            ) : slotsQuery.data?.onLeave ? (
              <p className="text-sm text-danger-600">Doctor is on leave that day.</p>
            ) : (slotsQuery.data?.slots.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">No schedule for this day. Use walk-in instead.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slotsQuery.data!.slots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setTime(s.time)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-medium",
                      !s.available && "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through",
                      s.available && time === s.time && "border-primary-500 bg-primary-500 text-white",
                      s.available && time !== s.time && "border-slate-200 text-slate-600 hover:border-primary-300",
                    )}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Select label="Visit type" value={visitType} onChange={(e) => setVisitType(e.target.value)} options={VISIT_TYPES} />
        {visitType === "Deserving" && <Badge tone="warning">Deserving — fee can be waived at billing</Badge>}
      </div>
    </Modal>
  );
}
