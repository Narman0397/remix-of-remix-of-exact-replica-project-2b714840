// Phase 3B — Public document verification page.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { sigGetVerification } from "@/lib/signature.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/verify-doc/$token")({
  head: () => ({ meta: [{ title: "Verifikasi Dokumen" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(sigGetVerification);
  const q = useQuery({
    queryKey: ["sig-verify", token],
    queryFn: () => fetchFn({ data: { requestId: token } }),
  });

  if (q.isLoading) {
    return <div className="mx-auto max-w-2xl p-8 text-center">Memuat verifikasi…</div>;
  }
  const v = q.data;
  if (!v || v.valid === false) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert /> Dokumen Tidak Ditemukan
            </CardTitle>
          </CardHeader>
          <CardContent>Token verifikasi tidak valid atau telah dihapus.</CardContent>
        </Card>
      </div>
    );
  }
  const r = v.request;
  const isSigned = r.status === "signed";
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className={isSigned ? "text-green-600" : "text-amber-600"} />
              Verifikasi Tanda Tangan Digital
            </span>
            <Badge variant={isSigned ? "default" : "secondary"} className="uppercase">
              {r.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Nomor Dokumen" value={r.doc_number ?? "—"} />
            <Field label="Nama Dokumen" value={r.doc_name ?? "—"} />
            <Field
              label="Tanggal Dokumen"
              value={r.doc_date ? new Date(r.doc_date).toLocaleString("id-ID") : "—"}
            />
            <Field
              label="Tanggal Tandatangan"
              value={r.completed_at ? new Date(r.completed_at).toLocaleString("id-ID") : "—"}
            />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-muted-foreground">Penandatangan</div>
            <ul className="space-y-1 text-sm">
              {r.signers.map((s, i) => (
                <li key={i} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <div className="font-medium">
                      {i + 1}. {s.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.position ?? "—"}
                      {s.nip ? ` • NIP ${s.nip}` : ""}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <Badge variant={s.status === "signed" ? "default" : "outline"}>{s.status}</Badge>
                    {s.signed_at && (
                      <div className="mt-1 text-muted-foreground">
                        {new Date(s.signed_at).toLocaleString("id-ID")}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-3 md:grid-cols-[auto_1fr]">
            <img src={r.qr_data_url} alt="QR Verifikasi" className="h-40 w-40 rounded border" />
            <div className="space-y-2 text-sm">
              <Field label="Document Hash (SHA-256)" mono value={r.hash ?? "—"} />
              {r.hash_match !== null && (
                <Badge
                  variant={r.hash_match ? "default" : "destructive"}
                  className="uppercase"
                >
                  Hash {r.hash_match ? "MATCH" : "MISMATCH"}
                </Badge>
              )}
              <div className="break-all text-xs text-muted-foreground">{r.verify_url}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={mono ? "break-all font-mono text-xs" : "text-sm"}>{value}</div>
    </div>
  );
}
