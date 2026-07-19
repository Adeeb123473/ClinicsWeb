import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { labApi, type LabOrder, type LabTest } from "../../features/lab/labApi";
import { clinicApi, type Patient } from "../../features/clinic/clinicApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Modal } from "../../components/Modal";
import { Textarea } from "../../components/Textarea";
import { PlusIcon, SearchIcon, FlaskIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { useAuthStore } from "../../store/authStore";
import { formatDateTime } from "../../utils/format";

const statusTone: Record<string, "info" | "warning" | "success" | "neutral"> = {
  Ordered: "info",
  Collected: "warning",
  Completed: "success",
  Cancelled: "neutral",
};

export function LabPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canOrder = role === "DOCTOR";
  const [ordering, setOrdering] = useState(false);
  const [resulting, setResulting] = useState<LabOrder | null>(null);

  const { data: orders, isLoading } = useQuery({ queryKey: ["lab-orders"], queryFn: () => labApi.listOrders() });

  const columns: Column<LabOrder>[] = [
    { key: "test", header: "Test", render: (o) => <span className="font-medium text-slate-800">{o.testName}</span> },
    {
      key: "patient",
      header: "Patient",
      render: (o) => (
        <div>
          <p className="text-slate-700">{o.patientName}</p>
          <p className="text-xs text-slate-400">{o.mrNo}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (o) => <Badge tone={statusTone[o.status] ?? "neutral"}>{o.status}</Badge> },
    { key: "ordered", header: "Ordered", render: (o) => formatDateTime(o.orderedAt) },
    { key: "result", header: "Result", render: (o) => (o.resultText ? <span className="text-xs text-slate-600">{o.resultText.slice(0, 40)}{o.resultText.length > 40 ? "…" : ""}</span> : <span className="text-slate-300">—</span>) },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (o) =>
        o.status !== "Completed" && o.status !== "Cancelled" ? (
          <Button size="sm" onClick={() => setResulting(o)}>
            Record result
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setResulting(o)}>
            View
          </Button>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lab"
        subtitle="Orders and results"
        actions={
          canOrder && (
            <Button onClick={() => setOrdering(true)}>
              <PlusIcon className="h-4 w-4" /> Order test
            </Button>
          )
        }
      />

      <Table
        columns={columns}
        rows={orders ?? []}
        rowKey={(o) => o.labOrderId}
        isLoading={isLoading}
        emptyTitle="No lab orders"
        emptyDescription={canOrder ? "Order a test for a patient to get started." : "Lab orders will appear here."}
      />

      {ordering && (
        <OrderModal
          onClose={() => setOrdering(false)}
          onOrdered={() => {
            setOrdering(false);
            queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
          }}
        />
      )}
      {resulting && (
        <ResultModal
          order={resulting}
          readonly={resulting.status === "Completed" || resulting.status === "Cancelled"}
          onClose={() => setResulting(null)}
          onSaved={() => {
            setResulting(null);
            queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
          }}
        />
      )}
    </div>
  );
}

function OrderModal({ onClose, onOrdered }: { onClose: () => void; onOrdered: () => void }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [testId, setTestId] = useState("");
  const [newTest, setNewTest] = useState("");

  const queryClient = useQueryClient();
  const tests = useQuery({ queryKey: ["lab-tests"], queryFn: labApi.listTests });
  const searchQuery = useQuery({
    queryKey: ["patients", "lab-search", search],
    queryFn: () => clinicApi.searchPatients(search, 1, 6),
    enabled: !patient && search.length > 1,
  });

  const createTest = useMutation({
    mutationFn: () => labApi.createTest(newTest, null, 0),
    onSuccess: (t: LabTest) => {
      setTestId(t.labTestId);
      setNewTest("");
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Test added");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const order = useMutation({
    mutationFn: () => labApi.order(patient!.PatientID, testId),
    onSuccess: () => {
      toast.success("Test ordered");
      onOrdered();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Order lab test"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button isLoading={order.isPending} disabled={!patient || !testId} onClick={() => order.mutate()}>Order</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {patient ? (
          <div className="flex items-center justify-between rounded-xl bg-primary-50 p-3">
            <div>
              <p className="font-medium text-slate-800">{patient.PatientName}</p>
              <p className="text-xs text-slate-500">{patient.MRNo}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPatient(null)}>Change</Button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search patient" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {searchQuery.data && searchQuery.data.data.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-100">
                {searchQuery.data.data.map((p) => (
                  <button key={p.PatientID} type="button" onClick={() => setPatient(p)} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <span>{p.PatientName}</span>
                    <span className="text-xs text-slate-400">{p.MRNo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Select
          label="Test"
          value={testId}
          onChange={(e) => setTestId(e.target.value)}
          placeholder="Select a test"
          options={(tests.data ?? []).map((t) => ({ value: t.labTestId, label: t.name }))}
        />
        <div className="flex items-end gap-2">
          <Input label="Or add a new test" value={newTest} onChange={(e) => setNewTest(e.target.value)} className="flex-1" />
          <Button variant="secondary" disabled={!newTest.trim()} isLoading={createTest.isPending} onClick={() => createTest.mutate()}>
            <FlaskIcon className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResultModal({ order, readonly, onClose, onSaved }: { order: LabOrder; readonly: boolean; onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState(order.resultText ?? "");
  const mutation = useMutation({
    mutationFn: () => labApi.recordResult(order.labOrderId, text),
    onSuccess: () => {
      toast.success("Result recorded");
      onSaved();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${order.testName} — ${order.patientName}`}
      footer={
        readonly ? (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button isLoading={mutation.isPending} disabled={!text.trim()} onClick={() => mutation.mutate()}>Save result</Button>
          </>
        )
      }
    >
      <Textarea label="Result" value={text} onChange={(e) => setText(e.target.value)} disabled={readonly} className="min-h-[140px]" />
    </Modal>
  );
}
