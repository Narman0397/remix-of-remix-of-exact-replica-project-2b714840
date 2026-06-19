import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminGuard } from "@/components/admin/AdminGuard";

export const Route = createFileRoute("/_authenticated/admin/signature")({
  head: () => ({ meta: [{ title: "Tanda Tangan Digital (TTE) — Admin" }] }),
  component: () => (
    <AdminGuard>
      <Layout />
    </AdminGuard>
  ),
});

function Layout() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/admin/signature", label: "Dashboard", exact: true },
    { to: "/admin/signature/queue", label: "Signature Queue" },
    { to: "/admin/signature/monitoring", label: "Monitoring" },
    { to: "/admin/signature/providers", label: "Provider" },
  ];
  return (
    <AdminShell breadcrumb={[{ label: "Tanda Tangan Digital (TTE)" }]}>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                active
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </AdminShell>
  );
}
