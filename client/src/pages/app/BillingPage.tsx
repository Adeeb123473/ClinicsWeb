import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicApi, type InvoiceSummary, type Invoice, type Patient } from "../../features/clinic/clinicApi";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Modal } from "../../components/Modal";
import { PlusIcon, PrintIcon, SearchIcon, TrashIcon } from "../../components/icons";
import { PlanUpgradeNotice } from "../../components/PlanUpgradeNotice";
import { toast } from "../../store/toastStore";
import { errorMessage, errorCode } from "../../api/http";
import { formatCurrency, formatDate } from "../../utils/format";
import { printHtml, receiptHtml } from "../../utils/print";

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  Paid: "success",
  PartiallyPaid: "warning",
  Unpaid: "danger",
  Void: "neutral",
};

export function BillingPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<InvoiceSummary | null>(null);

  const { data: invoices, isLoading, isError, error } = useQuery({ queryKey: ["invoices"], queryFn: () => clinicApi.listInvoices() });

  const printReceipt = async (inv: InvoiceSummary) => {
    const full = await clinicApi.getInvoice(inv.invoiceId);
    printHtml(
      `Receipt ${full.invoiceNo}`,
      receiptHtml({
        clinicName: "ClinicOS",
        invoiceNo: full.invoiceNo,
        patientName: full.patientName,
        mrNo: full.mrNo,
        date: formatDate(full.createdAt),
        items: full.items,
        subtotal: full.subtotal,
        discount: full.discount,
        tax: full.tax,
        total: full.total,
        paidAmount: full.paidAmount,
        status: full.status,
        currency: "Rs",
      }),
    );
  };

  const columns: Column<InvoiceSummary>[] = [
    { key: "no", header: "Invoice", render: (i) => <span className="font-mono text-xs font-semibold text-primary-700">{i.invoiceNo}</span> },
    {
      key: "patient",
      header: "Patient",
      render: (i) => (
        <div>
          <p className="font-medium text-slate-800">{i.patientName}</p>
          <p className="text-xs text-slate-400">{i.mrNo}</p>
        </div>
      ),
    },
    { key: "total", header: "Total", render: (i) => formatCurrency(i.total) },
    { key: "paid", header: "Paid", render: (i) => formatCurrency(i.paidAmount) },
    { key: "status", header: "Status", render: (i) => <Badge tone={statusTone[i.status] ?? "neutral"}>{i.status}</Badge> },
    { key: "date", header: "Date", render: (i) => formatDate(i.createdAt) },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (i) => (
        <div className="flex justify-end gap-1">
          {i.status !== "Paid" && i.status !== "Void" && (
            <Button size="sm" onClick={() => setPaying(i)}>
              Record payment
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => printReceipt(i)} aria-label="Print receipt">
            <PrintIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isError && errorCode(error) === "PLAN_FEATURE_NOT_INCLUDED") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Billing" subtitle="Invoices, payments, and receipts" />
        <PlanUpgradeNotice message={errorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments, and receipts"
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" /> New invoice
          </Button>
        }
      />

      <Table
        columns={columns}
        rows={invoices ?? []}
        rowKey={(i) => i.invoiceId}
        isLoading={isLoading}
        emptyTitle="No invoices yet"
        emptyDescription="Create an invoice for a patient visit."
        emptyAction={<Button onClick={() => setCreating(true)}>New invoice</Button>}
      />

      {creating && (
        <CreateInvoiceModal
          onClose={() => setCreating(false)}
          onCreated={(inv) => {
            setCreating(false);
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            printReceipt(inv);
          }}
        />
      )}
      {paying && (
        <PaymentModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            setPaying(null);
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      )}
    </div>
  );
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

function CreateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (inv: Invoice) => void }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([{ description: "Consultation fee", quantity: 1, unitPrice: 0 }]);

  const searchQuery = useQuery({
    queryKey: ["patients", "bill-search", search],
    queryFn: () => clinicApi.searchPatients(search, 1, 6),
    enabled: !patient && search.length > 1,
  });

  const mutation = useMutation({
    mutationFn: () =>
      clinicApi.createInvoice({
        patientId: patient!.PatientID,
        discount,
        items: items.filter((it) => it.description && it.unitPrice >= 0),
      }),
    onSuccess: (inv) => {
      toast.success(`Invoice ${inv.invoiceNo} created`);
      onCreated(inv);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title="New invoice"
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={mutation.isPending} disabled={!patient || subtotal <= 0} onClick={() => mutation.mutate()}>
            Create invoice
          </Button>
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
            <Button size="sm" variant="ghost" onClick={() => setPatient(null)}>
              Change
            </Button>
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

        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Line items</p>
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                placeholder="Description"
                value={it.description}
                onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                className="flex-1"
              />
              <Input
                type="number"
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))}
                className="w-16"
              />
              <Input
                type="number"
                placeholder="Price"
                value={it.unitPrice}
                onChange={(e) => setItems(items.map((x, i) => (i === idx ? { ...x, unitPrice: Number(e.target.value) } : x)))}
                className="w-24"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                disabled={items.length === 1}
                aria-label="Remove item"
              >
                <TrashIcon className="h-4 w-4 text-danger-500" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])}>
            <PlusIcon className="h-4 w-4" /> Add item
          </Button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <Input label="Discount" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-32" />
          <div className="text-right">
            <p className="text-sm text-slate-500">Subtotal</p>
            <p className="text-lg font-semibold text-slate-900">{formatCurrency(subtotal)}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({ invoice, onClose, onPaid }: { invoice: InvoiceSummary; onClose: () => void; onPaid: () => void }) {
  const remaining = invoice.total - invoice.paidAmount;
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState("Cash");

  const mutation = useMutation({
    mutationFn: () => clinicApi.recordPayment(invoice.invoiceId, amount, method),
    onSuccess: () => {
      toast.success("Payment recorded");
      onPaid();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Record payment — ${invoice.invoiceNo}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={mutation.isPending} disabled={amount <= 0 || amount > remaining} onClick={() => mutation.mutate()}>
            Record
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Total</span>
            <span className="font-medium">{formatCurrency(invoice.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Outstanding</span>
            <span className="font-semibold text-danger-600">{formatCurrency(remaining)}</span>
          </div>
        </div>
        <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <Select
          label="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: "Cash", label: "Cash" },
            { value: "Card", label: "Card" },
            { value: "BankTransfer", label: "Bank Transfer" },
            { value: "Insurance", label: "Insurance" },
            { value: "Other", label: "Other" },
          ]}
        />
      </div>
    </Modal>
  );
}
