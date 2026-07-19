import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Plan, type PlanInput } from "../../features/admin/adminApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { Input } from "../../components/Input";
import { Modal } from "../../components/Modal";
import { PlusIcon, EditIcon, TrashIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { formatCurrency } from "../../utils/format";

const empty: PlanInput = { name: "", priceMonthly: 0, maxUsers: null, maxPatients: null, features: [], isActive: true };

export function PlansPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: plans, isLoading } = useQuery({ queryKey: ["admin", "plans"], queryFn: adminApi.listPlans });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePlan(id),
    onSuccess: () => {
      toast.success("Plan deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: Column<Plan>[] = [
    { key: "name", header: "Plan", render: (p) => <span className="font-medium text-slate-800">{p.name}</span> },
    { key: "price", header: "Monthly", render: (p) => formatCurrency(p.priceMonthly) },
    { key: "users", header: "Max Users", render: (p) => p.maxUsers ?? "Unlimited" },
    { key: "patients", header: "Max Patients", render: (p) => p.maxPatients ?? "Unlimited" },
    {
      key: "features",
      header: "Features",
      render: (p) => (
        <div className="flex flex-wrap gap-1">
          {p.features.map((f) => (
            <Badge key={f} tone="info">
              {f}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: "active", header: "Status", render: (p) => <Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge> },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label="Edit plan">
            <EditIcon className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete plan "${p.name}"?`)) deleteMutation.mutate(p.planId);
            }}
            aria-label="Delete plan"
          >
            <TrashIcon className="h-4 w-4 text-danger-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Subscription Plans"
        subtitle="Define the tiers clinics can subscribe to"
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> New Plan
          </Button>
        }
      />

      <Table
        columns={columns}
        rows={plans ?? []}
        rowKey={(p) => p.planId}
        isLoading={isLoading}
        emptyTitle="No plans yet"
        emptyDescription="Create your first subscription plan to start onboarding clinics."
        emptyAction={<Button onClick={() => setCreating(true)}>New Plan</Button>}
      />

      {(creating || editing) && (
        <PlanFormModal
          plan={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
          }}
        />
      )}
    </div>
  );
}

function PlanFormModal({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<PlanInput>(
    plan
      ? {
          name: plan.name,
          priceMonthly: plan.priceMonthly,
          maxUsers: plan.maxUsers,
          maxPatients: plan.maxPatients,
          features: plan.features,
          isActive: plan.isActive,
        }
      : empty,
  );
  const [featuresText, setFeaturesText] = useState((plan?.features ?? []).join(", "));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: PlanInput = {
        ...form,
        features: featuresText.split(",").map((f) => f.trim()).filter(Boolean),
      };
      return plan ? adminApi.updatePlan(plan.planId, payload) : adminApi.createPlan(payload);
    },
    onSuccess: () => {
      toast.success(plan ? "Plan updated" : "Plan created");
      onSaved();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? "Edit plan" : "New plan"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={mutation.isPending} disabled={!form.name.trim()} onClick={() => mutation.mutate()}>
            {plan ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input
          label="Monthly price"
          type="number"
          value={form.priceMonthly}
          onChange={(e) => setForm({ ...form, priceMonthly: Number(e.target.value) })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Max users (blank = unlimited)"
            type="number"
            value={form.maxUsers ?? ""}
            onChange={(e) => setForm({ ...form, maxUsers: e.target.value ? Number(e.target.value) : null })}
          />
          <Input
            label="Max patients (blank = unlimited)"
            type="number"
            value={form.maxPatients ?? ""}
            onChange={(e) => setForm({ ...form, maxPatients: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <Input
          label="Features (comma-separated)"
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          hint="e.g. appointments, billing, reports, lab"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-primary-600"
          />
          Active (visible on public pricing)
        </label>
      </div>
    </Modal>
  );
}
