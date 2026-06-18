// Phase 1B — Settings tab (placeholder). Konfigurasi default form-builder
// (notifikasi default, prefill mapping global, dst.) akan diisi pada 1B.3 / 1B.4.
import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/form-builder/settings")({
  head: () => ({
    meta: [{ title: "Settings — Form Builder" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-display text-lg font-bold">Form Builder Settings</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Pengaturan global form builder (default notifikasi, prefill mapping, kebijakan versioning)
        akan tersedia pada sub-batch berikutnya.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
        <li>Default notifikasi ke pemohon &amp; reviewer (sub-batch 1B.4)</li>
        <li>Mapping default ASN Prefill (sub-batch 1B.3)</li>
        <li>Kebijakan auto-create version saat edit setelah publish (sub-batch 1B.4)</li>
      </ul>
    </div>
  );
}
