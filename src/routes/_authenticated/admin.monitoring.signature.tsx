import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashSignature } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/monitoring/signature")({
  component: Page,
});

function Page() {
  const fn = useServerFn(dashSignature);
  const q = useQuery({
    queryKey: ["dash", "signature"],
    queryFn: () => fn(),
    refetchInterval: 45_000,
  });
  const d = q.data;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Pending" value={d?.pending ?? 0} />
        <Stat label="Signed Today" value={d?.signedToday ?? 0} />
        <Stat label="Rejected" value={d?.rejected ?? 0} />
        <Stat label="Expired" value={d?.expired ?? 0} />
        <Stat label="Failed" value={d?.failed ?? 0} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Per Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2">Provider</th>
                <th className="p-2">Pending</th>
                <th className="p-2">Signed</th>
                <th className="p-2">Failed</th>
              </tr>
            </thead>
            <tbody>
              {(d?.perProvider ?? []).map((p) => (
                <tr key={p.code} className="border-b">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">{p.pending}</td>
                  <td className="p-2">{p.signed}</td>
                  <td className="p-2">{p.failed}</td>
                </tr>
              ))}
              {(d?.perProvider ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString("id-ID")}</div>
      </CardContent>
    </Card>
  );
}
