import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicApi, type Appointment } from "../../features/clinic/clinicApi";
import { BookAppointmentModal } from "../../features/clinic/BookAppointmentModal";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { Input } from "../../components/Input";
import { PlusIcon } from "../../components/icons";
import { PlanUpgradeNotice } from "../../components/PlanUpgradeNotice";
import { toast } from "../../store/toastStore";
import { errorMessage, errorCode } from "../../api/http";
import { formatTime } from "../../utils/format";

const statusTone: Record<string, "info" | "warning" | "primary" | "success" | "danger" | "neutral"> = {
  Scheduled: "info",
  CheckedIn: "warning",
  InConsultation: "primary",
  Completed: "success",
  Cancelled: "neutral",
  NoShow: "danger",
};

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [booking, setBooking] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const { data, isLoading, isError, error } = useQuery({ queryKey: ["appointments", date], queryFn: () => clinicApi.getQueue({ date }) });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => clinicApi.setStatus(id, "Cancelled"),
    onSuccess: () => {
      toast.success("Appointment cancelled");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: Column<Appointment>[] = [
    { key: "token", header: "Token", render: (a) => <span className="font-semibold text-primary-700">{a.tokenNo}</span> },
    { key: "time", header: "Time", render: (a) => formatTime(a.appointmentTime) },
    {
      key: "patient",
      header: "Patient",
      render: (a) => (
        <div>
          <p className="font-medium text-slate-800">{a.patientName}</p>
          <p className="text-xs text-slate-400">{a.mrNo}</p>
        </div>
      ),
    },
    { key: "doctor", header: "Doctor", render: (a) => a.doctorName },
    { key: "visit", header: "Visit", render: (a) => <Badge tone="neutral">{a.visitType}</Badge> },
    { key: "status", header: "Status", render: (a) => <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge> },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (a) =>
        ["Completed", "Cancelled"].includes(a.status) ? null : (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setRescheduling(a)}>
              Reschedule
            </Button>
            <Button size="sm" variant="danger" onClick={() => cancelMutation.mutate(a.appointmentId)}>
              Cancel
            </Button>
          </div>
        ),
    },
  ];

  if (isError && errorCode(error) === "PLAN_FEATURE_NOT_INCLUDED") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Appointments" subtitle="Schedule and manage appointments" />
        <PlanUpgradeNotice message={errorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appointments"
        subtitle="Schedule and manage appointments"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm shadow-soft"
            />
            <Button onClick={() => setBooking(true)}>
              <PlusIcon className="h-4 w-4" /> Book
            </Button>
          </div>
        }
      />

      <Table
        columns={columns}
        rows={data ?? []}
        rowKey={(a) => a.appointmentId}
        isLoading={isLoading}
        emptyTitle="No appointments"
        emptyDescription="Book an appointment for this date."
        emptyAction={<Button onClick={() => setBooking(true)}>Book appointment</Button>}
      />

      {booking && (
        <BookAppointmentModal
          date={date}
          onClose={() => setBooking(false)}
          onBooked={() => {
            setBooking(false);
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
          }}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
          }}
        />
      )}
    </div>
  );
}

function RescheduleModal({ appointment, onClose, onDone }: { appointment: Appointment; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(appointment.appointmentDate.slice(0, 10));
  const [time, setTime] = useState(appointment.appointmentTime.slice(0, 5));

  const mutation = useMutation({
    mutationFn: () => clinicApi.reschedule(appointment.appointmentId, date, time),
    onSuccess: () => {
      toast.success("Rescheduled");
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reschedule — ${appointment.patientName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            Reschedule
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
    </Modal>
  );
}
