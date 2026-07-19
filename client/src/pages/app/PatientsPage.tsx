import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clinicApi, type Patient } from "../../features/clinic/clinicApi";
import { PatientFormModal } from "../../features/clinic/PatientFormModal";
import { PageHeader } from "../../components/PageHeader";
import { Table, type Column } from "../../components/Table";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { PlusIcon, SearchIcon, PrintIcon, EditIcon } from "../../components/icons";
import { useAuthStore } from "../../store/authStore";
import { formatDate } from "../../utils/format";
import { printHtml, patientCardHtml } from "../../utils/print";

const categoryTone: Record<string, "primary" | "warning" | "info" | "neutral"> = {
  General: "neutral",
  Deserving: "warning",
  Staff: "info",
  Insurance: "primary",
};

export function PatientsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const isClinical = role === "DOCTOR" || role === "NURSE" || role === "CLINIC_ADMIN";
  const canRegister = role === "RECEPTIONIST" || role === "CLINIC_ADMIN";
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => clinicApi.searchPatients(search, 1, 50),
  });

  const printCard = (p: Patient) => {
    const age = p.currentAge ? `${p.currentAge.value} ${p.currentAge.unit}` : "—";
    printHtml(
      `Patient Card ${p.MRNo}`,
      patientCardHtml({
        clinicName: "ClinicOS",
        mrNo: p.MRNo,
        patientName: p.PatientName,
        fatherHusbandName: p.FatherHusbandName,
        gender: p.Gender,
        age,
        mobileNo: p.MobileNo,
        cnic: p.CNIC,
        category: p.Category,
      }),
    );
  };

  const columns: Column<Patient>[] = [
    { key: "mr", header: "MR No", render: (p) => <span className="font-mono text-xs font-semibold text-primary-700">{p.MRNo}</span> },
    {
      key: "name",
      header: "Patient",
      render: (p) => (
        <div>
          <Link to={`/app/patients/${p.PatientID}`} className="font-medium text-slate-800 hover:text-primary-700">
            {p.PatientName}
          </Link>
          <p className="text-xs text-slate-400">{p.FatherHusbandName ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "demo",
      header: "Gender / Age",
      render: (p) => (
        <span className="text-slate-600">
          {p.Gender} · {p.currentAge ? `${p.currentAge.value} ${p.currentAge.unit}` : "—"}
        </span>
      ),
    },
    { key: "mobile", header: "Mobile", render: (p) => p.MobileNo ?? "—" },
    { key: "category", header: "Category", render: (p) => <Badge tone={categoryTone[p.Category] ?? "neutral"}>{p.Category}</Badge> },
    { key: "reg", header: "Registered", render: (p) => formatDate(p.RegistrationDate) },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => printCard(p)} aria-label="Print card">
            <PrintIcon className="h-4 w-4" />
          </Button>
          {canRegister && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(p)} aria-label="Edit">
              <EditIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Patients"
        subtitle="Search and manage patient records"
        actions={
          canRegister && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon className="h-4 w-4" /> Register patient
            </Button>
          )
        }
      />

      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by name, MR No, mobile, or CNIC"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Table
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(p) => p.PatientID}
        isLoading={isLoading}
        emptyTitle="No patients found"
        emptyDescription={canRegister ? "Register your first patient to get started." : "No patients match your search."}
        emptyAction={canRegister ? <Button onClick={() => setCreating(true)}>Register patient</Button> : undefined}
      />

      {(creating || editing) && (
        <PatientFormModal
          patient={editing ?? undefined}
          clinical={isClinical}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ["patients"] });
          }}
        />
      )}
    </div>
  );
}
