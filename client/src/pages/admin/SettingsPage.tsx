import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type PlatformSettings } from "../../features/admin/adminApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import { CenterSpinner } from "../../components/Spinner";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";

export function AdminSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["platform", "settings"], queryFn: adminApi.getPlatformSettings });
  if (isLoading || !data) return <CenterSpinner />;
  return <SettingsView initial={data} />;
}

function SettingsView({ initial }: { initial: PlatformSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>(initial);

  const saveSettings = useMutation({
    mutationFn: () => adminApi.updatePlatformSettings(form),
    onSuccess: () => {
      toast.success("Platform settings saved");
      queryClient.invalidateQueries({ queryKey: ["platform", "settings"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const set = (patch: Partial<PlatformSettings>) => setForm({ ...form, ...patch });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Platform Settings"
        subtitle="Global configuration"
        actions={<Button isLoading={saveSettings.isPending} onClick={() => saveSettings.mutate()}>Save settings</Button>}
      />

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">General</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Platform name" value={form.platformName} onChange={(e) => set({ platformName: e.target.value })} />
          <Input label="Support email" type="email" value={form.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.allowClinicRegistration}
              onChange={(e) => set({ allowClinicRegistration: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600"
            />
            Allow new clinics to register
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.maintenanceMode}
              onChange={(e) => set({ maintenanceMode: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary-600"
            />
            Maintenance mode banner
          </label>
        </div>
      </Card>
    </div>
  );
}
