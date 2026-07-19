import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Clinic, type ClinicStatus } from "../../features/admin/adminApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Modal } from "../../components/Modal";
import { SearchIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { formatDate } from "../../utils/format";

const statusTone: Record<ClinicStatus, "success" | "warning" | "danger" | "neutral"> = {
  Approved: "success",
  Pending: "warning",
  Suspended: "danger",
  Inactive: "neutral",
};

export function ClinicsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [planModal, setPlanModal] = useState<Clinic | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "clinics", status, search],
    queryFn: () => adminApi.listClinics({ status: status || undefined, search: search || undefined, limit: 50 }),
  });

  const plansQuery = useQuery({ queryKey: ["admin", "plans"], queryFn: adminApi.listPlans });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" | "suspend" | "reactivate" }) =>
      adminApi.clinicAction(id, action),
    onSuccess: (_data, vars) => {
      toast.success(`Clinic ${vars.action}d`);
      queryClient.invalidateQueries({ queryKey: ["admin", "clinics"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: Column<Clinic>[] = [
    {
      key: "name",
      header: "Clinic",
      render: (c) => (
        <div>
          <p className="font-medium text-slate-800">{c.clinicName}</p>
          <p className="text-xs text-slate-400">{c.email ?? "—"}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (c) => <Badge tone={statusTone[c.status]}>{c.status}</Badge> },
    { key: "plan", header: "Plan", render: (c) => c.planName ?? <span className="text-slate-400">None</span> },
    { key: "users", header: "Users", render: (c) => c.userCount },
    { key: "created", header: "Registered", render: (c) => formatDate(c.createdDate) },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          {c.status === "Pending" && (
            <>
              <Button size="sm" onClick={() => actionMutation.mutate({ id: c.clinicId, action: "approve" })}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate({ id: c.clinicId, action: "reject" })}>
                Reject
              </Button>
            </>
          )}
          {c.status === "Approved" && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setPlanModal(c)}>
                Plan
              </Button>
              <Button size="sm" variant="danger" onClick={() => actionMutation.mutate({ id: c.clinicId, action: "suspend" })}>
                Suspend
              </Button>
            </>
          )}
          {(c.status === "Suspended" || c.status === "Inactive") && (
            <Button size="sm" onClick={() => actionMutation.mutate({ id: c.clinicId, action: "reactivate" })}>
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clinics" subtitle="Review registrations and manage clinic subscriptions" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 pl-9"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="All statuses"
          options={[
            { value: "Pending", label: "Pending" },
            { value: "Approved", label: "Approved" },
            { value: "Suspended", label: "Suspended" },
            { value: "Inactive", label: "Inactive" },
          ]}
          className="w-44"
        />
      </div>

      <Table
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(c) => c.clinicId}
        isLoading={isLoading}
        emptyTitle="No clinics found"
        emptyDescription="Clinics that register will appear here for approval."
      />

      <AssignPlanModal
        clinic={planModal}
        plans={plansQuery.data ?? []}
        onClose={() => setPlanModal(null)}
        onAssigned={() => {
          setPlanModal(null);
          queryClient.invalidateQueries({ queryKey: ["admin", "clinics"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        }}
      />
    </div>
  );
}

function AssignPlanModal({
  clinic,
  plans,
  onClose,
  onAssigned,
}: {
  clinic: Clinic | null;
  plans: { planId: string; name: string }[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [planId, setPlanId] = useState("");
  const [expiry, setExpiry] = useState("");

  const mutation = useMutation({
    mutationFn: () => adminApi.assignPlan(clinic!.clinicId, planId, expiry || null),
    onSuccess: () => {
      toast.success("Plan assigned");
      onAssigned();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open={Boolean(clinic)}
      onClose={onClose}
      title={`Assign plan — ${clinic?.clinicName ?? ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={mutation.isPending} disabled={!planId} onClick={() => mutation.mutate()}>
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Subscription plan"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          placeholder="Select a plan"
          options={plans.map((p) => ({ value: p.planId, label: p.name }))}
        />
        <Input label="Expiry date (optional)" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
    </Modal>
  );
}
