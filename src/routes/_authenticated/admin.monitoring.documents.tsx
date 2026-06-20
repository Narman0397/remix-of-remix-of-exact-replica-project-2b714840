import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { dashDocuments } from "@/lib/dashboard.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/monitoring/documents")({
  component: Page,
});

function Page() {
  const fn = useServerFn(dashDocuments);
  const q = useQuery({
    queryKey: ["dash", "documents"],
    queryFn: () => fn(),
    refetchInterval: 60_000,
  });
  const d = q.data;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Stat label="Generated Today" value={d?.generatedToday ?? 0} />
      <Stat label="Draft" value={d?.draft ?? 0} />
      <Stat label="Pending Signature" value={d?.pendingSignature ?? 0} />
      <Stat label="Signed" value={d?.signed ?? 0} />
      <Stat label="Archived" value={d?.archived ?? 0} />
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
