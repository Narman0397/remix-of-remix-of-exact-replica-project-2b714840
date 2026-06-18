// Phase 1B — Form Builder hub layout: tabs Forms / Templates / Settings.
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { FileText, LayoutTemplate, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/form-builder")({
  head: () => ({
    meta: [{ title: "Form Builder — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Form Builder" }]}>
        <Layout />
      </AdminShell>
    </AdminGuard>
  ),
});

function Layout() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">Form Builder</h2>
        <p className="text-sm text-muted-foreground">
          Kelola form, template, dan pengaturan workflow di satu tempat.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        <TabLink to="/admin/form-builder" label="Forms" icon={FileText} exact />
        <TabLink to="/admin/form-builder/templates" label="Templates" icon={LayoutTemplate} />
        <TabLink to="/admin/form-builder/settings" label="Settings" icon={SettingsIcon} />
      </div>
      <Outlet />
    </div>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
