// Phase 3A — Generated documents list.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { docListDocuments, docDownloadDocument, docArchiveDocument } from "@/lib/documents.functions";
import { Download, Archive, Loader2 } from "lucide-react";

type Row = {
  id: string;
  doc_number: string | null;
  name: string | null;
  status: string;
  template_id: string | null;
  submission_id: string;
  mime: string;
  size_bytes: number | null;
  generated_at: string;
  archived_at: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/documents/generated")({
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const payload: Record<string, unknown> = { archived: false };
        if (status) payload.status = status;
        if (q) payload.q = q;
        const r = (await docListDocuments({ data: payload as never })) as unknown as { rows: Row[] };
        if (!cancelled) setRows(r.rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, q, tick]);

  async function download(id: string) {
    const r = (await docDownloadDocument({ data: { id } })) as { url: string; name: string };
    window.open(r.url, "_blank");
  }
  async function archive(id: string) {
    if (!confirm("Arsipkan dokumen ini?")) return;
    await docArchiveDocument({ data: { id } });
    setTick((t) => t + 1);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Generated Documents</h3>
        <div className="flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nomor / nama…"
            className="h-9 rounded-md border bg-background px-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="generated">Generated</option>
            <option value="pending_signature">Pending Signature</option>
            <option value="signed">Signed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nomor</th>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Tipe</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Generated</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Belum ada dokumen.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.doc_number ?? "—"}</td>
                <td className="px-3 py-2">{r.name ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.mime.split("/").pop()}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">
                  {new Date(r.generated_at).toLocaleString("id-ID")}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => download(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Download className="h-3 w-3" /> Unduh
                    </button>
                    <button
                      onClick={() => archive(r.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      <Archive className="h-3 w-3" /> Arsip
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
