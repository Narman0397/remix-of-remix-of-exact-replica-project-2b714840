// Phase 1B — Templates tab (skeleton list). Detail editor & marketplace masuk sub-batch 1B.4.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fbListTemplates, fbCreateTemplate } from "@/lib/form-builder.functions";
import { useAuth } from "@/lib/auth-context";
import { LayoutTemplate, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/form-builder/templates")({
  head: () => ({
    meta: [{ title: "Templates — Form Builder" }, { name: "robots", content: "noindex" }],
  }),
  component: TemplatesPage,
});

type Template = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  scope: string;
  status: string;
  allowed_employee_types: string[];
  updated_at: string;
};

function TemplatesPage() {
  const { isSuperAdmin, isAdminPemda } = useAuth();
  const isElevated = isSuperAdmin || isAdminPemda;
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const r = (await fbListTemplates({ data: {} })) as Template[];
        setItems(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [tick]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Template Library</h3>
          <p className="text-xs text-muted-foreground">
            Gunakan template untuk membuat form lebih cepat. Template global hanya dapat dibuat oleh
            Super Admin / Admin Pemda.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1 rounded-md bg-gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
        >
          <Plus className="h-4 w-4" /> Template Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Nama</th>
              <th className="px-3 py-2">Kategori</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Diperbarui</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Belum ada template.
                </td>
              </tr>
            )}
            {items.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                    {t.name}
                  </div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground line-clamp-1">{t.description}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{t.category ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      t.scope === "global" ? "bg-primary-soft text-primary" : "bg-muted"
                    }`}
                  >
                    {t.scope}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs uppercase">{t.status}</td>
                <td className="px-3 py-2 text-xs">
                  {new Date(t.updated_at).toLocaleDateString("id-ID")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewTemplateDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            setTick((t) => t + 1);
          }}
          isElevated={isElevated}
        />
      )}
    </div>
  );
}

function NewTemplateDialog({
  onClose,
  onCreated,
  isElevated,
}: {
  onClose: () => void;
  onCreated: () => void;
  isElevated: boolean;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState<"opd" | "global">("opd");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (name.trim().length < 3) return alert("Nama minimal 3 karakter");
    setBusy(true);
    try {
      await fbCreateTemplate({
        data: {
          name: name.trim(),
          category: category.trim() || null,
          scope,
        },
      });
      onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-elevated">
        <h3 className="mb-3 font-display text-lg font-bold">Template Baru</h3>
        <label className="block text-xs font-medium">Nama Template</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <label className="mt-3 block text-xs font-medium">Kategori</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <label className="mt-3 block text-xs font-medium">Scope</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "opd" | "global")}
          className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="opd">OPD (lokal)</option>
          {isElevated && <option value="global">Global (Pemda-wide)</option>}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
            Batal
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-md bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            {busy ? "Membuat…" : "Buat"}
          </button>
        </div>
      </div>
    </div>
  );
}
