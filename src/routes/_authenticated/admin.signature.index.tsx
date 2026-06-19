import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigListMonitoring, sigListProviders } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/signature/")({
  component: Page,
});

function Page() {
  const m = useServerFn(sigListMonitoring);
  const p = useServerFn(sigListProviders);
  const mq = useQuery({ queryKey: ["sig", "monitoring"], queryFn: () => m() });
  const pq = useQuery({ queryKey: ["sig", "providers"], queryFn: () => p() });
  const s = mq.data?.snapshot;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Ringkasan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total" value={s?.total ?? 0} />
            <Stat label="Pending" value={s?.pending ?? 0} />
            <Stat label="Sent" value={s?.sent ?? 0} />
            <Stat label="Signed" value={s?.signed ?? 0} />
            <Stat label="Rejected" value={s?.rejected ?? 0} />
            <Stat label="Expired" value={s?.expired ?? 0} />
            <Stat label="Cancelled" value={s?.cancelled ?? 0} />
            <Stat label="Failed" value={s?.failed ?? 0} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(pq.data?.providers ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border p-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.code} • {p.kind}
                  </div>
                </div>
                <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
