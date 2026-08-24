import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicAdminApi, type ClinicSettings } from "../../features/clinicAdmin/clinicAdminApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { CenterSpinner } from "../../components/Spinner";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ClinicSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["clinic", "settings"], queryFn: clinicAdminApi.getSettings });
  if (isLoading || !data) return <CenterSpinner />;
  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: ClinicSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClinicSettings>(initial);

  const mutation = useMutation({
    mutationFn: (payload: ClinicSettings) =>
      clinicAdminApi.updateSettings({
        clinicName: payload.clinicName,
        address: payload.address,
        phone: payload.phone,
        email: payload.email,
        timeZone: payload.timeZone,
        operatingHours: payload.operatingHours,
        settings: payload.settings,
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["clinic", "settings"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const set = (patch: Partial<ClinicSettings>) => setForm({ ...form, ...patch });
  const setSetting = (patch: Partial<ClinicSettings["settings"]>) => setForm({ ...form, settings: { ...form.settings, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clinic Settings"
        subtitle="Profile, hours, fees, and print templates"
        actions={<Button isLoading={mutation.isPending} onClick={() => mutation.mutate(form)}>Save changes</Button>}
      />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Clinic profile</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Clinic name" value={form.clinicName} onChange={(e) => set({ clinicName: e.target.value })} />
          <Input label="Time zone" value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })} />
          <Input label="Phone" value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
          <Input label="Email" value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} />
          <Input label="Address" className="sm:col-span-2" value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Operating hours</h3>
        <div className="flex flex-col gap-2">
          {DAYS.map((day) => {
            const h = form.operatingHours[day] ?? { open: "09:00", close: "17:00", closed: false };
            return (
              <div key={day} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-sm font-medium text-slate-600">{day}</span>
                <label className="flex items-center gap-1.5 text-sm text-slate-500">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) => set({ operatingHours: { ...form.operatingHours, [day]: { ...h, closed: !e.target.checked } } })}
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                  />
                  Open
                </label>
                <input
                  type="time"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => set({ operatingHours: { ...form.operatingHours, [day]: { ...h, open: e.target.value } } })}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="time"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => set({ operatingHours: { ...form.operatingHours, [day]: { ...h, close: e.target.value } } })}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-sm disabled:bg-slate-50"
                />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Numbering & billing</h3>
          <div className="flex flex-col gap-4">
            <Input
              label="MR No format"
              value={form.settings.mrNoFormat}
              onChange={(e) => setSetting({ mrNoFormat: e.target.value })}
              hint="Tokens: {YYYY} year, {seq} zero-padded sequence"
            />
            <Input label="Invoice prefix" value={form.settings.invoicePrefix} onChange={(e) => setSetting({ invoicePrefix: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tax %"
                type="number"
                value={form.settings.taxPercent}
                onChange={(e) => setSetting({ taxPercent: Number(e.target.value) })}
              />
              <Input label="Currency" value={form.settings.currency} onChange={(e) => setSetting({ currency: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.settings.tokenResetDaily}
                onChange={(e) => setSetting({ tokenResetDaily: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-primary-600"
              />
              Reset token numbers daily
            </label>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Receipt print template</h3>
          <p className="mb-4 mt-1 text-xs text-slate-500">
            Printed above and below billing receipts, under the clinic name.
          </p>
          <div className="flex flex-col gap-4">
            <Textarea
              label="Header"
              value={form.settings.billingHeader}
              onChange={(e) => setSetting({ billingHeader: e.target.value })}
              placeholder="e.g. address and phone number"
            />
            <Textarea
              label="Footer"
              value={form.settings.billingFooter}
              onChange={(e) => setSetting({ billingFooter: e.target.value })}
              placeholder="e.g. Thank you for your visit · refund policy"
            />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Token slip print template</h3>
          <p className="mb-4 mt-1 text-xs text-slate-500">
            Printed above and below queue token slips, under the clinic name.
          </p>
          <div className="flex flex-col gap-4">
            <Textarea
              label="Header"
              value={form.settings.tokenHeader}
              onChange={(e) => setSetting({ tokenHeader: e.target.value })}
              placeholder="e.g. address and phone number"
            />
            <Textarea
              label="Footer"
              value={form.settings.tokenFooter}
              onChange={(e) => setSetting({ tokenFooter: e.target.value })}
              placeholder="e.g. Please keep this slip until your turn"
            />
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Prescription printing</h3>
          <p className="mt-1 text-xs text-slate-500">
            Prescriptions print from each doctor’s own letterhead, set up per doctor under{" "}
            <strong>Staff → Letterhead</strong>, so there is no clinic-wide prescription header here.
          </p>
        </Card>
      </div>
    </div>
  );
}
