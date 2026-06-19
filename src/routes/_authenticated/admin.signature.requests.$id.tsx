import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigGetStatus } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/signature/requests/$id")({
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const fn = useServerFn(sigGetStatus);
  const q = useQuery({ queryKey: ["sig", "req", id], queryFn: () => fn({ data: { requestId: id } }) });
  if (q.isLoading) return <div>Memuat…</div>;
  const r = q.data?.request as
    | {
        id: string;
        status: string;
        mode: string;
        external_request_id: string | null;
        file_hash: string | null;
        sent_at: string | null;
        completed_at: string | null;
        error: string | null;
        provider: { code: string; name: string } | null;
        document: { id: string; doc_number: string | null; name: string | null; status: string };
        signers: Array<{
          id: string;
          order_index: number;
          signer_type: string;
          user_id: string | null;
          role: string | null;
          position: string | null;
          status: string;
          signed_at: string | null;
          rejected_at: string | null;
          reject_reason: string | null;
        }>;
      }
    | undefined;
  if (!r) return <div>Request tidak ditemukan.</div>;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Detail Signature Request</span>
            <Badge variant={r.status === "signed" ? "default" : "outline"} className="uppercase">
              {r.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <div>
            <strong>Provider:</strong> {r.provider?.name ?? "—"} ({r.provider?.code ?? "—"})
          </div>
          <div>
            <strong>Mode:</strong> {r.mode}
          </div>
          <div>
            <strong>Document:</strong> {r.document?.doc_number ?? "—"} — {r.document?.name ?? "—"}
          </div>
          <div>
            <strong>External ID:</strong> {r.external_request_id ?? "—"}
          </div>
          <div className="break-all">
            <strong>File Hash:</strong> <span className="font-mono text-xs">{r.file_hash ?? "—"}</span>
          </div>
          <div>
            <strong>Sent:</strong>{" "}
            {r.sent_at ? new Date(r.sent_at).toLocaleString("id-ID") : "—"}
          </div>
          <div>
            <strong>Completed:</strong>{" "}
            {r.completed_at ? new Date(r.completed_at).toLocaleString("id-ID") : "—"}
          </div>
          {r.error && (
            <div className="md:col-span-2 text-destructive">
              <strong>Error:</strong> {r.error}
            </div>
          )}
          <div className="md:col-span-2">
            <Link
              to="/verify-doc/$token"
              params={{ token: r.id }}
              target="_blank"
              className="text-xs text-primary underline"
            >
              Buka halaman verifikasi publik
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signer</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {r.signers
              .slice()
              .sort((a, b) => a.order_index - b.order_index)
              .map((s) => (
                <li key={s.id} className="rounded border p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      #{s.order_index + 1} • {s.signer_type} •{" "}
                      {s.role ?? s.position ?? s.user_id ?? "—"}
                    </div>
                    <Badge variant={s.status === "signed" ? "default" : "outline"}>
                      {s.status}
                    </Badge>
                  </div>
                  {s.signed_at && (
                    <div className="text-xs text-muted-foreground">
                      Signed: {new Date(s.signed_at).toLocaleString("id-ID")}
                    </div>
                  )}
                  {s.reject_reason && (
                    <div className="text-xs text-destructive">Reason: {s.reject_reason}</div>
                  )}
                </li>
              ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline / Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {(q.data?.events ?? []).map((e) => {
              const ev = e as {
                id: string;
                event: string;
                created_at: string;
                payload: Record<string, unknown>;
              };
              return (
                <li key={ev.id} className="rounded border p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{ev.event}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {Object.keys(ev.payload ?? {}).length > 0 && (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-1 text-xs">
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
