import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type PlatformSettings, type Announcement } from "../../features/admin/adminApi";
import { PageHeader } from "../../components/PageHeader";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Textarea } from "../../components/Textarea";
import { Button } from "../../components/Button";
import { Badge } from "../../components/Badge";
import { CenterSpinner } from "../../components/Spinner";
import { PlusIcon, TrashIcon } from "../../components/icons";
import { toast } from "../../store/toastStore";
import { errorMessage } from "../../api/http";
import { formatDate } from "../../utils/format";

export function AdminSettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["platform", "settings"], queryFn: adminApi.getPlatformSettings });
  if (isLoading || !data) return <CenterSpinner />;
  return <SettingsView initial={data} />;
}

function SettingsView({ initial }: { initial: PlatformSettings }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlatformSettings>(initial);

  const announcements = useQuery({ queryKey: ["platform", "announcements"], queryFn: adminApi.listAnnouncements });

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
        subtitle="Global configuration and announcements"
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

      <AnnouncementsCard
        announcements={announcements.data ?? []}
        loading={announcements.isLoading}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ["platform", "announcements"] })}
      />
    </div>
  );
}

const levelTone: Record<string, "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

function AnnouncementsCard({
  announcements,
  loading,
  onChanged,
}: {
  announcements: Announcement[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState("info");

  const create = useMutation({
    mutationFn: () => adminApi.createAnnouncement({ title, body: body || null, level }),
    onSuccess: () => {
      toast.success("Announcement published");
      setTitle("");
      setBody("");
      setLevel("info");
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminApi.toggleAnnouncement(id, isActive),
    onSuccess: onChanged,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteAnnouncement(id),
    onSuccess: () => {
      toast.success("Announcement removed");
      onChanged();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-800">Announcements</h3>
      <p className="mb-4 text-xs text-slate-400">Active announcements appear as a banner on every clinic's dashboard.</p>

      <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance Sunday 2am" />
          <Select
            label="Level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            options={[
              { value: "info", label: "Info" },
              { value: "warning", label: "Warning" },
              { value: "critical", label: "Critical" },
            ]}
            className="sm:w-40"
          />
        </div>
        <Textarea label="Message (optional)" value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" disabled={!title.trim()} isLoading={create.isPending} onClick={() => create.mutate()}>
            <PlusIcon className="h-4 w-4" /> Publish
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {loading ? (
          <p className="py-4 text-center text-sm text-slate-400">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No announcements yet</p>
        ) : (
          announcements.map((a) => (
            <div key={a.announcementId} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={levelTone[a.level] ?? "info"}>{a.level}</Badge>
                  <p className="truncate font-medium text-slate-800">{a.title}</p>
                  {!a.isActive && <Badge tone="neutral">inactive</Badge>}
                </div>
                {a.body && <p className="mt-1 text-sm text-slate-500">{a.body}</p>}
                <p className="mt-0.5 text-xs text-slate-400">{formatDate(a.createdAt)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => toggle.mutate({ id: a.announcementId, isActive: !a.isActive })}>
                  {a.isActive ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.announcementId)} aria-label="Delete announcement">
                  <TrashIcon className="h-4 w-4 text-danger-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
