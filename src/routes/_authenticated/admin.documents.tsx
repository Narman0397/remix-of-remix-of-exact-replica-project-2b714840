// Phase 3A — Document Center layout.
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminShell } from "@/components/admin/AdminShell";
import { FileText, FilePlus2, Hash, Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  head: () => ({
    meta: [{ title: "Document Center — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <AdminGuard>
      <AdminShell breadcrumb={[{ label: "Document Center" }]}>
        <Layout />
      </AdminShell>
    </AdminGuard>
  ),
});

function Layout() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold">Document Center</h2>
        <p className="text-sm text-muted-foreground">
          Kelola template, dokumen yang dihasilkan, aturan penomoran, dan arsip.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
        <Tab to="/admin/documents/templates" label="Templates" icon={FileText} />
        <Tab to="/admin/documents/generated" label="Generated" icon={FilePlus2} />
        <Tab to="/admin/documents/numbering" label="Numbering" icon={Hash} />
        <Tab to="/admin/documents/archive" label="Archive" icon={Archive} />
      </div>
      <Outlet />
    </div>
  );
}

function Tab({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
