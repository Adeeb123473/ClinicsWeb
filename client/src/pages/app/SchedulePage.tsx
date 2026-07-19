import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicApi, type Doctor } from "../../features/clinic/clinicApi";
import { clinicalApi } from "../../features/clinical/clinicalApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Badge } from "../../components/Badge";
import { CenterSpinner } from "../../components/Spinner";
import { TrashIcon, PlusIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { useAuthStore } from "../../store/authStore";
import { formatDate } from "../../utils/format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DaySlot {
  enabled: boolean;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  maxTokens: number | null;
}

export function SchedulePage() {
  const fullName = useAuthStore((s) => s.user?.fullName);
  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: clinicApi.listDoctors });
  const mine = doctorsQuery.data?.find((d) => d.doctorName === fullName);

  if (doctorsQuery.isLoading) return <CenterSpinner />;
  if (!mine) return <p className="text-slate-500">No doctor profile is linked to your account.</p>;
  return <ScheduleEditor doctor={mine} />;
}

function ScheduleEditor({ doctor }: { doctor: Doctor }) {
  const queryClient = useQueryClient();
  const scheduleQuery = useQuery({ queryKey: ["schedule", doctor.doctorId], queryFn: () => clinicalApi.getSchedule(doctor.doctorId) });

  if (scheduleQuery.isLoading || !scheduleQuery.data) return <CenterSpinner />;
  return <ScheduleForm doctorId={doctor.doctorId} data={scheduleQuery.data} onSaved={() => queryClient.invalidateQueries({ queryKey: ["schedule", doctor.doctorId] })} />;
}

function ScheduleForm({
  doctorId,
  data,
  onSaved,
}: {
  doctorId: string;
  data: Awaited<ReturnType<typeof clinicalApi.getSchedule>>;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<DaySlot[]>(() =>
    DAYS.map((_, dow) => {
      const existing = data.schedule.find((s) => s.dayOfWeek === dow);
      return existing
        ? { enabled: true, startTime: existing.startTime, endTime: existing.endTime, slotDurationMinutes: existing.slotDurationMinutes, maxTokens: existing.maxTokens }
        : { enabled: false, startTime: "09:00", endTime: "17:00", slotDurationMinutes: 15, maxTokens: 40 };
    }),
  );
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  const setDay = (idx: number, patch: Partial<DaySlot>) => setDays(days.map((d, i) => (i === idx ? { ...d, ...patch } : d)));

  const saveMutation = useMutation({
    mutationFn: () => {
      const slots = days
        .map((d, dow) => ({ dayOfWeek: dow, ...d }))
        .filter((d) => d.enabled)
        .map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, slotDurationMinutes: d.slotDurationMinutes, maxTokens: d.maxTokens }));
      return clinicalApi.setSchedule(doctorId, slots);
    },
    onSuccess: () => {
      toast.success("Schedule saved");
      onSaved();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const addLeave = useMutation({
    mutationFn: () => clinicalApi.addLeave(doctorId, leaveDate, leaveReason || null),
    onSuccess: () => {
      toast.success("Leave added");
      setLeaveDate("");
      setLeaveReason("");
      queryClient.invalidateQueries({ queryKey: ["schedule", doctorId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeLeave = useMutation({
    mutationFn: (leaveId: string) => clinicalApi.removeLeave(doctorId, leaveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule", doctorId] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My Schedule" subtitle="Weekly availability and leave days" actions={<Button isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save schedule</Button>} />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Weekly template</h3>
        <div className="flex flex-col gap-2">
          {days.map((d, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-2.5">
              <label className="flex w-28 items-center gap-2 text-sm font-medium text-slate-600">
                <input type="checkbox" checked={d.enabled} onChange={(e) => setDay(idx, { enabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
                {DAYS[idx]}
              </label>
              <input type="time" value={d.startTime} disabled={!d.enabled} onChange={(e) => setDay(idx, { startTime: e.target.value })} className="h-9 rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50" />
              <span className="text-slate-400">to</span>
              <input type="time" value={d.endTime} disabled={!d.enabled} onChange={(e) => setDay(idx, { endTime: e.target.value })} className="h-9 rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50" />
              <label className="text-xs text-slate-500">Slot (min)</label>
              <input type="number" value={d.slotDurationMinutes} disabled={!d.enabled} onChange={(e) => setDay(idx, { slotDurationMinutes: Number(e.target.value) })} className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50" />
              <label className="text-xs text-slate-500">Max tokens</label>
              <input type="number" value={d.maxTokens ?? ""} disabled={!d.enabled} onChange={(e) => setDay(idx, { maxTokens: e.target.value ? Number(e.target.value) : null })} className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Leave days</h3>
        <div className="flex flex-wrap items-end gap-3">
          <Input label="Date" type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
          <Input label="Reason (optional)" value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="w-56" />
          <Button variant="secondary" disabled={!leaveDate} isLoading={addLeave.isPending} onClick={() => addLeave.mutate()}>
            <PlusIcon className="h-4 w-4" /> Add leave
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.leaves.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming leave</p>
          ) : (
            data.leaves.map((l) => (
              <Badge key={l.leaveId} tone="warning" className="flex items-center gap-1.5">
                {formatDate(l.leaveDate)}
                {l.reason ? ` · ${l.reason}` : ""}
                <button type="button" onClick={() => removeLeave.mutate(l.leaveId)} aria-label="Remove leave" className="ml-1">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
