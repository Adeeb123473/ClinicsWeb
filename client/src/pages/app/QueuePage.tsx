import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { clinicApi, type Appointment } from "../../features/clinic/clinicApi";
import { BookAppointmentModal } from "../../features/clinic/BookAppointmentModal";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { CenterSpinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { PlusIcon, PrintIcon } from "../../components/icons";
import { PlanUpgradeNotice } from "../../components/PlanUpgradeNotice";
import { toast } from "../../store/toastStore";
import { errorMessage, errorCode } from "../../api/http";
import { printHtml, tokenSlipHtml } from "../../utils/print";

const statusTone: Record<string, "info" | "warning" | "primary" | "success" | "danger" | "neutral"> = {
  Scheduled: "info",
  CheckedIn: "warning",
  InConsultation: "primary",
  Completed: "success",
  Cancelled: "neutral",
  NoShow: "danger",
};

const NEXT_ACTIONS: Record<string, { label: string; status: string; variant?: "primary" | "secondary" | "danger" }[]> = {
  Scheduled: [
    { label: "Check in", status: "CheckedIn" },
    { label: "No-show", status: "NoShow", variant: "secondary" },
    { label: "Cancel", status: "Cancelled", variant: "danger" },
  ],
  CheckedIn: [{ label: "Cancel", status: "Cancelled", variant: "danger" }],
  InConsultation: [],
  Completed: [],
  Cancelled: [],
  NoShow: [{ label: "Re-schedule to queue", status: "Scheduled", variant: "secondary" }],
};

export function QueuePage() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [booking, setBooking] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["queue", date],
    queryFn: () => clinicApi.getQueue({ date }),
    refetchInterval: 15000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => clinicApi.setStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queue"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const byDoctor = useMemo(() => {
    const groups = new Map<string, { doctorName: string; roomNo: string | null; appts: Appointment[] }>();
    for (const a of data ?? []) {
      if (!groups.has(a.doctorId)) groups.set(a.doctorId, { doctorName: a.doctorName, roomNo: a.roomNo, appts: [] });
      groups.get(a.doctorId)!.appts.push(a);
    }
    return [...groups.values()];
  }, [data]);

  const printToken = (a: Appointment) =>
    printHtml(
      `Token ${a.tokenNo}`,
      tokenSlipHtml({
        clinicName: "ClinicOS",
        tokenNo: a.tokenNo,
        patientName: a.patientName,
        mrNo: a.mrNo,
        doctorName: a.doctorName,
        roomNo: a.roomNo,
        date: a.appointmentDate.slice(0, 10),
        visitType: a.visitType,
      }),
    );

  if (isError && errorCode(error) === "PLAN_FEATURE_NOT_INCLUDED") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Queue" subtitle="Live token board" />
        <PlanUpgradeNotice message={errorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Queue"
        subtitle="Live token board"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm shadow-soft"
            />
            <Button onClick={() => setBooking(true)}>
              <PlusIcon className="h-4 w-4" /> Book / Walk-in
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <CenterSpinner />
      ) : byDoctor.length === 0 ? (
        <EmptyState
          title="No appointments"
          description="Book a walk-in or scheduled appointment to start the queue."
          action={<Button onClick={() => setBooking(true)}>Book appointment</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {byDoctor.map((group) => (
            <Card key={group.doctorName} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{group.doctorName}</h3>
                  <p className="text-xs text-slate-400">Room {group.roomNo ?? "—"} · {group.appts.length} tokens</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {group.appts.map((a) => (
                  <motion.div
                    key={a.appointmentId}
                    layout
                    className="rounded-xl border border-slate-100 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-lg font-bold text-primary-700">
                          {a.tokenNo}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{a.patientName}</p>
                          <p className="text-xs text-slate-400">
                            {a.mrNo} · {a.visitType}
                          </p>
                        </div>
                      </div>
                      <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {(NEXT_ACTIONS[a.status] ?? []).map((action) => (
                        <Button
                          key={action.status}
                          size="sm"
                          variant={action.variant ?? "primary"}
                          isLoading={statusMutation.isPending && statusMutation.variables?.id === a.appointmentId}
                          onClick={() => statusMutation.mutate({ id: a.appointmentId, status: action.status })}
                        >
                          {action.label}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => printToken(a)} aria-label="Print token">
                        <PrintIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {booking && (
        <BookAppointmentModal
          date={date}
          onClose={() => setBooking(false)}
          onBooked={(a) => {
            setBooking(false);
            queryClient.invalidateQueries({ queryKey: ["queue"] });
            printToken(a);
          }}
        />
      )}
    </div>
  );
}
