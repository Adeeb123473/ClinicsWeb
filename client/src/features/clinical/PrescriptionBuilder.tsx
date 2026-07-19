import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clinicalApi, type PrescriptionItem, type PrescriptionTemplate } from "./clinicalApi";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { Select } from "../../components/Select";
import { PlusIcon, TrashIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";

const FREQUENCIES = ["OD", "BID", "TID", "QID", "HS", "SOS", "STAT"];

const emptyItem: PrescriptionItem = { medicineName: "", dosage: null, frequency: null, durationDays: null, instructions: null };

export function PrescriptionBuilder({
  items,
  onChange,
  templates,
  onTemplatesChanged,
}: {
  items: PrescriptionItem[];
  onChange: (items: PrescriptionItem[]) => void;
  templates: PrescriptionTemplate[];
  onTemplatesChanged: () => void;
}) {
  const [medQuery, setMedQuery] = useState("");
  const medicines = useQuery({
    queryKey: ["medicines", medQuery],
    queryFn: () => clinicalApi.searchMedicines(medQuery),
    enabled: medQuery.length > 1,
  });

  const setItem = (idx: number, patch: Partial<PrescriptionItem>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.templateId === id);
    if (t) onChange([...items.filter((it) => it.medicineName), ...t.items]);
  };

  const saveAsTemplate = async () => {
    const valid = items.filter((it) => it.medicineName.trim());
    if (valid.length === 0) return;
    const name = prompt("Template name?");
    if (!name) return;
    try {
      await clinicalApi.saveTemplate(name, valid);
      toast.success("Template saved");
      onTemplatesChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {templates.length > 0 && (
          <Select
            value=""
            onChange={(e) => e.target.value && applyTemplate(e.target.value)}
            placeholder="Insert template…"
            options={templates.map((t) => ({ value: t.templateId, label: t.name }))}
            className="w-52"
          />
        )}
        <div className="flex-1" />
        <Button size="sm" variant="secondary" onClick={saveAsTemplate}>
          Save as template
        </Button>
      </div>

      {medQuery.length > 1 && (medicines.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {medicines.data!.map((m) => (
            <button
              key={m.medicineId}
              type="button"
              onClick={() => {
                onChange([...items.filter((it) => it.medicineName), { ...emptyItem, medicineName: m.name, dosage: m.defaultDosage }]);
                setMedQuery("");
              }}
              className="rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-700 hover:bg-primary-100"
            >
              + {m.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Medicine"
                value={it.medicineName}
                onChange={(e) => {
                  setItem(idx, { medicineName: e.target.value });
                  setMedQuery(e.target.value);
                }}
                className="flex-1"
              />
              <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label="Remove">
                <TrashIcon className="h-4 w-4 text-danger-500" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input placeholder="Dosage" value={it.dosage ?? ""} onChange={(e) => setItem(idx, { dosage: e.target.value })} />
              <Select
                value={it.frequency ?? ""}
                onChange={(e) => setItem(idx, { frequency: e.target.value || null })}
                placeholder="Frequency"
                options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
              />
              <Input
                type="number"
                placeholder="Days"
                value={it.durationDays ?? ""}
                onChange={(e) => setItem(idx, { durationDays: e.target.value ? Number(e.target.value) : null })}
              />
              <Input placeholder="Instructions" value={it.instructions ?? ""} onChange={(e) => setItem(idx, { instructions: e.target.value })} />
            </div>
          </div>
        ))}
      </div>

      <Button size="sm" variant="secondary" onClick={() => onChange([...items, { ...emptyItem }])} className="self-start">
        <PlusIcon className="h-4 w-4" /> Add medicine
      </Button>
    </div>
  );
}
