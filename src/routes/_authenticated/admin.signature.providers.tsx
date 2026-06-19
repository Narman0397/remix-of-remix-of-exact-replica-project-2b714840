import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sigListProviders, sigToggleProvider } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/signature/providers")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(sigListProviders);
  const toggle = useServerFn(sigToggleProvider);
  const q = useQuery({ queryKey: ["sig", "providers", "page"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (args: { id: string; status: "active" | "disabled" }) =>
      toggle({ data: args }),
    onSuccess: () => {
      toast.success("Provider diperbarui");
      qc.invalidateQueries({ queryKey: ["sig", "providers"] });
      qc.invalidateQueries({ queryKey: ["sig", "providers", "page"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signature Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data?.providers ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.code}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.kind}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "active" ? "default" : "outline"}>{p.status}</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      m.mutate({
                        id: p.id,
                        status: p.status === "active" ? "disabled" : "active",
                      })
                    }
                  >
                    {p.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
