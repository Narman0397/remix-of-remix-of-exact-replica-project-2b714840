import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigListMonitoring } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/signature/monitoring")({
  component: Page,
});

function Page() {
  const fn = useServerFn(sigListMonitoring);
  const q = useQuery({ queryKey: ["sig", "monitoring", "page"], queryFn: () => fn() });
  const s = q.data?.snapshot;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Monitoring per Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(["pending", "sent", "signed", "rejected", "expired", "cancelled", "failed"] as const).map(
              (k) => (
                <div key={k} className="rounded border bg-card p-3">
                  <div className="text-xs uppercase text-muted-foreground">{k}</div>
                  <div className="text-2xl font-semibold">{s?.[k] ?? 0}</div>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Provider Failures</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Pending/Sent</TableHead>
                <TableHead>Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(s?.perProvider ?? []).map((p) => (
                <TableRow key={p.code}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.pending}</TableCell>
                  <TableCell>
                    {p.failed > 0 ? <Badge variant="destructive">{p.failed}</Badge> : 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
