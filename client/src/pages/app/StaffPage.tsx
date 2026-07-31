import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicAdminApi, type StaffMember, type CreateStaffInput } from "../../features/clinicAdmin/clinicAdminApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Modal } from "../../components/Modal";
import { PlusIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { titleCase, formatDate } from "../../utils/format";

const ROLE_OPTIONS = [
  { value: "DOCTOR", label: "Doctor" },
  { value: "RECEPTIONIST", label: "Receptionist" },
  { value: "NURSE", label: "Nurse" },
  { value: "CLINIC_ADMIN", label: "Clinic Admin" },
];

const roleTone: Record<string, "primary" | "info" | "warning" | "neutral"> = {
  CLINIC_ADMIN: "primary",
  DOCTOR: "info",
  RECEPTIONIST: "warning",
  NURSE: "neutral",
};

export function StaffPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<StaffMember | null>(null);

  const { data: staff, isLoading } = useQuery({ queryKey: ["clinic", "staff"], queryFn: clinicAdminApi.listStaff });

  const statusMutation = useMutation({
    mutationFn: (m: StaffMember) =>
      clinicAdminApi.updateStaff(m.userId, {
        fullName: m.fullName,
        email: m.email,
        phone: m.phone,
        status: m.status === "Active" ? "Inactive" : "Active",
        specialization: m.doctor?.specialization,
        consultationFee: m.doctor?.consultationFee,
        followUpFee: m.doctor?.followUpFee,
        roomNo: m.doctor?.roomNo,
      }),
    onSuccess: () => {
      toast.success("Staff updated");
      queryClient.invalidateQueries({ queryKey: ["clinic", "staff"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const columns: Column<StaffMember>[] = [
    {
      key: "name",
      header: "Name",
      render: (s) => (
        <div>
          <p className="font-medium text-slate-800">{s.fullName}</p>
          <p className="text-xs text-slate-400">@{s.username}</p>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (s) => <Badge tone={roleTone[s.role] ?? "neutral"}>{titleCase(s.role)}</Badge> },
    {
      key: "detail",
      header: "Details",
      render: (s) =>
        s.doctor ? (
          <span className="text-xs text-slate-500">
            {s.doctor.specialization ?? "—"} · Rs {s.doctor.consultationFee} · Room {s.doctor.roomNo ?? "—"}
          </span>
        ) : (
          <span className="text-xs text-slate-400">{s.email ?? "—"}</span>
        ),
    },
    { key: "status", header: "Status", render: (s) => <Badge tone={s.status === "Active" ? "success" : "neutral"}>{s.status}</Badge> },
    { key: "created", header: "Added", render: (s) => formatDate(s.createdAt) },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (s) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setResetting(s)}>
            Reset password
          </Button>
          <Button
            size="sm"
            variant={s.status === "Active" ? "secondary" : "primary"}
            onClick={() => statusMutation.mutate(s)}
          >
            {s.status === "Active" ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Staff"
        subtitle="Invite and manage your clinic's team"
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> Add staff
          </Button>
        }
      />

      <Table
        columns={columns}
        rows={staff ?? []}
        rowKey={(s) => s.userId}
        isLoading={isLoading}
        emptyTitle="No staff yet"
        emptyDescription="Add doctors, receptionists, and nurses to your clinic."
        emptyAction={<Button onClick={() => setCreating(true)}>Add staff</Button>}
      />

      {creating && (
        <CreateStaffModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ["clinic", "staff"] });
          }}
        />
      )}
      {resetting && <ResetPasswordModal staff={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function CreateStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateStaffInput>({ username: "", password: "", role: "RECEPTIONIST", fullName: "" });

  const mutation = useMutation({
    mutationFn: () => clinicAdminApi.createStaff(form),
    onSuccess: () => {
      toast.success("Staff member added");
      onCreated();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const isDoctor = form.role === "DOCTOR";

  return (
    <Modal
      open
      onClose={onClose}
      title="Add staff member"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            isLoading={mutation.isPending}
            disabled={!form.username || !form.password || !form.fullName}
            onClick={() => mutation.mutate()}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLE_OPTIONS}
          />
        </div>
        <Input
          label="Temporary password"
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          hint="8+ chars with upper, lower, and a digit. User must change it on first login."
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email (optional)" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone (optional)" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        {isDoctor && (
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Doctor profile</p>
            <div className="flex flex-col gap-3">
              <Input
                label="Specialization"
                value={form.specialization ?? ""}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Consult fee (optional)"
                  type="number"
                  placeholder="0"
                  value={form.consultationFee ?? ""}
                  onChange={(e) => setForm({ ...form, consultationFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                  hint="Defaults to 0"
                />
                <Input
                  label="Follow-up fee (optional)"
                  type="number"
                  placeholder="0"
                  value={form.followUpFee ?? ""}
                  onChange={(e) => setForm({ ...form, followUpFee: e.target.value === "" ? undefined : Number(e.target.value) })}
                  hint="Defaults to 0"
                />
                <Input label="Room" value={form.roomNo ?? ""} onChange={(e) => setForm({ ...form, roomNo: e.target.value })} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: () => clinicAdminApi.resetPassword(staff.userId, password),
    onSuccess: () => {
      toast.success("Password reset");
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password — ${staff.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={mutation.isPending} disabled={password.length < 8} onClick={() => mutation.mutate()}>
            Reset
          </Button>
        </>
      }
    >
      <Input
        label="New temporary password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint="The user will be required to change it at next login."
      />
    </Modal>
  );
}
