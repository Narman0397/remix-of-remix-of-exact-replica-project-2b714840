// Phase 1B.2 — Form Wizard orchestrator (7 langkah horizontal).
// Persist state via useWizardDraft (localStorage + server autosave 1000ms).
import { memo, useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { FormDesigner } from "@/features/forms/designer/FormDesigner";
import { PreviewPanel } from "@/features/forms/designer/PreviewPanel";
import { fwCommitNewForm, fwLogFieldEvent } from "@/lib/form-wizard.functions";
import {
  STEP_LABEL,
  WIZARD_STEPS,
  type EmploymentType,
  type WizardPayload,
  type WizardStep,
} from "@/features/forms/wizard/types";
import { useWizardDraft } from "@/features/forms/wizard/useWizardDraft";
import { Check, ChevronLeft, ChevronRight, Save, Eye, Send, Loader2 } from "lucide-react";
import { SYSTEM_VARIABLES } from "@/features/forms/services/form-prefill.service";

interface Props {
  localId: string;
  initialServerId?: string | null;
  initialPayload?: WizardPayload;
  initialStep?: WizardStep;
  isElevated: boolean;
}

const EMPLOYMENT: EmploymentType[] = ["PNS", "PPPK", "PPPK_PW", "NON_ASN"];
const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  PNS: "PNS",
  PPPK: "PPPK",
  PPPK_PW: "PPPK PW",
  NON_ASN: "Non ASN",
};

export function FormWizard(props: Props) {
  const { state, status, error, setPayload, setStep, forceSave, reset } = useWizardDraft({
    localId: props.localId,
    initialServerId: props.initialServerId,
    initialPayload: props.initialPayload,
    initialStep: props.initialStep,
  });
  const commitFn = useServerFn(fwCommitNewForm);
  const logFn = useServerFn(fwLogFieldEvent);
  const nav = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState<null | "draft" | "publish">(null);

  const stepIdx = WIZARD_STEPS.indexOf(state.step);
  const goPrev = () => stepIdx > 0 && setStep(WIZARD_STEPS[stepIdx - 1]);
  const goNext = () => stepIdx < WIZARD_STEPS.length - 1 && setStep(WIZARD_STEPS[stepIdx + 1]);

  const errors = useMemo(() => validatePayload(state.payload), [state.payload]);

  const emitAudit = useCallback(
    (event: string, meta?: Record<string, unknown>) => {
      // best-effort — jangan blokir UI
      void logFn({
        data: {
          formId: state.formId ?? null,
          event: event as
            | "field.add"
            | "field.remove"
            | "field.reorder"
            | "field.update"
            | "field.update_validation"
            | "field.update_conditional",
          metadata: meta ?? {},
        },
      }).catch(() => {});
    },
    [logFn, state.formId],
  );

  async function commit(publish: boolean) {
    if (errors.length > 0) {
      alert("Lengkapi dulu: " + errors.join("; "));
      return;
    }
    setSubmitting(publish ? "publish" : "draft");
    try {
      await forceSave();
      const res = (await commitFn({
        data: {
          draftId: state.serverId ?? undefined,
          general: {
            name: state.payload.general.name,
            code: state.payload.general.code || null,
            description: state.payload.general.description || null,
            category: state.payload.general.category || null,
            sla_days: state.payload.general.sla_days ?? null,
          },
          employment: { types: state.payload.employment.types },
          permissions: {
            opd_pemilik_id: state.payload.permissions.opd_pemilik_id,
            allow_multiple_submit: state.payload.permissions.allow_multiple_submit,
          },
          fields: state.payload.design.fields,
          publish,
        },
      })) as { id: string };
      reset();
      void nav({ to: "/admin/forms/$id", params: { id: res.id } });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal membuat form");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-4 grid grid-cols-7 gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {WIZARD_STEPS.map((s, i) => {
          const active = state.step === s;
          const done = i < stepIdx;
          return (
            <li key={s}>
              <button
                onClick={() => setStep(s)}
                className={`flex w-full items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                    active
                      ? "bg-primary-foreground text-primary"
                      : done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="truncate">{STEP_LABEL[s]}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Status bar */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <SaveStatus status={status} savedAt={state.savedAt} />
        {error && <span className="text-destructive">{error}</span>}
        {errors.length > 0 && (
          <span className="text-amber-600">{errors.length} item perlu dilengkapi</span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" /> {showPreview ? "Tutup Preview" : "Preview"}
          </button>
          <button
            onClick={() => void forceSave()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted"
          >
            <Save className="h-3.5 w-3.5" /> Save draft
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <PreviewPanel fields={state.payload.design.fields} />
        </div>
      )}

      {/* Step body */}
      <div className="rounded-lg border border-border bg-card p-4">
        <StepBody
          step={state.step}
          payload={state.payload}
          setPayload={setPayload}
          isElevated={props.isElevated}
          emitAudit={emitAudit}
        />
      </div>

      {/* Nav buttons */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={goPrev}
          disabled={stepIdx === 0}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Kembali
        </button>
        {state.step !== "review" ? (
          <button
            onClick={goNext}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Lanjut <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => void commit(false)}
              disabled={!!submitting}
              className="inline-flex items-center gap-1 rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              {submitting === "draft" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Simpan sebagai Draft
            </button>
            <button
              onClick={() => void commit(true)}
              disabled={!!submitting || errors.length > 0}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting === "publish" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveStatus({
  status,
  savedAt,
}: {
  status: "idle" | "saving" | "saved" | "error";
  savedAt: string | null;
}) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan…
      </span>
    );
  if (status === "error") return <span className="text-destructive">Gagal menyimpan</span>;
  if (savedAt)
    return (
      <span className="text-muted-foreground">
        Tersimpan {new Date(savedAt).toLocaleTimeString("id-ID")}
      </span>
    );
  return <span className="text-muted-foreground">Belum disimpan</span>;
}

function validatePayload(p: WizardPayload): string[] {
  const errs: string[] = [];
  if (!p.general.name || p.general.name.trim().length < 3) errs.push("Nama form min 3 karakter");
  if (p.employment.types.length === 0) errs.push("Pilih minimal 1 tipe pegawai");
  if (p.design.fields.length === 0) errs.push("Tambah minimal 1 field");
  return errs;
}

// =====================================================================
// Step body
// =====================================================================
const StepBody = memo(function StepBody({
  step,
  payload,
  setPayload,
  isElevated,
  emitAudit,
}: {
  step: WizardStep;
  payload: WizardPayload;
  setPayload: (u: (p: WizardPayload) => WizardPayload) => void;
  isElevated: boolean;
  emitAudit: (e: string, m?: Record<string, unknown>) => void;
}) {
  switch (step) {
    case "general":
      return <GeneralStep payload={payload} setPayload={setPayload} />;
    case "employment":
      return <EmploymentStep payload={payload} setPayload={setPayload} />;
    case "design":
      return (
        <DesignStep payload={payload} setPayload={setPayload} emitAudit={emitAudit} />
      );
    case "validation":
      return <ValidationOverviewStep payload={payload} />;
    case "permissions":
      return (
        <PermissionsStep payload={payload} setPayload={setPayload} isElevated={isElevated} />
      );
    case "notifications":
      return <NotificationsStep payload={payload} setPayload={setPayload} />;
    case "review":
      return <ReviewStep payload={payload} setPayload={setPayload} />;
  }
});

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function GeneralStep({ payload, setPayload }: { payload: WizardPayload; setPayload: Props["isElevated"] extends boolean ? (u: (p: WizardPayload) => WizardPayload) => void : never }) {
  const g = payload.general;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="md:col-span-2">
        <span className={labelCls}>Nama Form *</span>
        <input
          className={inputCls}
          value={g.name}
          onChange={(e) => setPayload((p) => ({ ...p, general: { ...p.general, name: e.target.value } }))}
        />
      </label>
      <label>
        <span className={labelCls}>Kode (opsional)</span>
        <input
          className={inputCls}
          value={g.code}
          onChange={(e) => setPayload((p) => ({ ...p, general: { ...p.general, code: e.target.value } }))}
        />
      </label>
      <label>
        <span className={labelCls}>Kategori</span>
        <input
          className={inputCls}
          value={g.category}
          onChange={(e) => setPayload((p) => ({ ...p, general: { ...p.general, category: e.target.value } }))}
        />
      </label>
      <label className="md:col-span-2">
        <span className={labelCls}>Deskripsi</span>
        <textarea
          className={`${inputCls} min-h-[80px]`}
          value={g.description}
          onChange={(e) => setPayload((p) => ({ ...p, general: { ...p.general, description: e.target.value } }))}
        />
      </label>
      <label>
        <span className={labelCls}>SLA (hari)</span>
        <input
          type="number"
          className={inputCls}
          value={g.sla_days ?? ""}
          onChange={(e) =>
            setPayload((p) => ({
              ...p,
              general: { ...p.general, sla_days: e.target.value === "" ? null : Number(e.target.value) },
            }))
          }
        />
      </label>
    </div>
  );
}

function EmploymentStep({
  payload,
  setPayload,
}: {
  payload: WizardPayload;
  setPayload: (u: (p: WizardPayload) => WizardPayload) => void;
}) {
  const selected = new Set(payload.employment.types);
  function toggle(t: EmploymentType) {
    const next = new Set(selected);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setPayload((p) => ({ ...p, employment: { types: Array.from(next) } }));
  }
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Pilih siapa yang berhak mengisi form ini berdasarkan tipe pegawai.
      </p>
      <div className="flex flex-wrap gap-2">
        {EMPLOYMENT.map((t) => {
          const on = selected.has(t);
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {EMPLOYMENT_LABEL[t]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DesignStep({
  payload,
  setPayload,
  emitAudit,
}: {
  payload: WizardPayload;
  setPayload: (u: (p: WizardPayload) => WizardPayload) => void;
  emitAudit: (e: string, m?: Record<string, unknown>) => void;
}) {
  return (
    <FormDesigner
      fields={payload.design.fields}
      onChange={(fields) => setPayload((p) => ({ ...p, design: { fields } }))}
      emitAudit={emitAudit}
    />
  );
}

function ValidationOverviewStep({ payload }: { payload: WizardPayload }) {
  const fields = payload.design.fields;
  const withRules = fields.filter((f) => {
    const v = f.validation ?? {};
    return Object.keys(v).length > 0;
  });
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Ringkasan validasi per field. Edit detail validasi langsung di tab <strong>Validation</strong>
        pada panel properti masing-masing field (step Design).
      </p>
      {withRules.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada aturan validasi.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Field</th>
              <th className="py-2">Rules</th>
            </tr>
          </thead>
          <tbody>
            {withRules.map((f) => (
              <tr key={f.kode} className="border-b border-border/40">
                <td className="py-2 font-medium">{f.label}</td>
                <td className="py-2 text-xs">
                  {Object.entries(f.validation ?? {})
                    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : String(v)}`)
                    .join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PermissionsStep({
  payload,
  setPayload,
  isElevated,
}: {
  payload: WizardPayload;
  setPayload: (u: (p: WizardPayload) => WizardPayload) => void;
  isElevated: boolean;
}) {
  const [opdList, setOpdList] = useState<Array<{ id: string; nama: string; singkatan: string }>>([]);
  useEffect(() => {
    if (!isElevated) return;
    void supabase
      .from("opd")
      .select("id,nama,singkatan")
      .order("nama")
      .then(({ data }) => setOpdList((data ?? []) as typeof opdList));
  }, [isElevated]);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {isElevated && (
        <label>
          <span className={labelCls}>OPD Pemilik</span>
          <select
            className={inputCls}
            value={payload.permissions.opd_pemilik_id ?? ""}
            onChange={(e) =>
              setPayload((p) => ({
                ...p,
                permissions: { ...p.permissions, opd_pemilik_id: e.target.value || null },
              }))
            }
          >
            <option value="">— Tidak ditetapkan —</option>
            {opdList.map((o) => (
              <option key={o.id} value={o.id}>
                {o.singkatan} — {o.nama}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="md:col-span-2 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={payload.permissions.allow_multiple_submit}
          onChange={(e) =>
            setPayload((p) => ({
              ...p,
              permissions: { ...p.permissions, allow_multiple_submit: e.target.checked },
            }))
          }
        />
        Izinkan submission berganda per ASN
      </label>
      <p className="md:col-span-2 text-xs text-muted-foreground">
        Pengaturan target audience lebih spesifik (per role/unit/individu) bisa ditambah setelah
        form dibuat melalui menu Targets.
      </p>
    </div>
  );
}

function NotificationsStep({
  payload,
  setPayload,
}: {
  payload: WizardPayload;
  setPayload: (u: (p: WizardPayload) => WizardPayload) => void;
}) {
  const n = payload.notifications;
  function set<K extends keyof typeof n>(key: K, v: (typeof n)[K]) {
    setPayload((p) => ({ ...p, notifications: { ...p.notifications, [key]: v } }));
  }
  return (
    <div className="grid gap-2">
      <Check2 label="Notifikasi saat ASN submit" checked={n.notify_on_submit} onChange={(v) => set("notify_on_submit", v)} />
      <Check2
        label="Notifikasi saat approve / reject"
        checked={n.notify_on_approve_reject}
        onChange={(v) => set("notify_on_approve_reject", v)}
      />
      <Check2
        label="Notifikasi saat disposisi"
        checked={n.notify_on_disposition}
        onChange={(v) => set("notify_on_disposition", v)}
      />
    </div>
  );
}

function Check2({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function ReviewStep({
  payload,
  setPayload,
}: {
  payload: WizardPayload;
  setPayload: (u: (p: WizardPayload) => WizardPayload) => void;
}) {
  // Prefill mapping editor sederhana
  const fieldKeys = payload.design.fields.map((f) => f.kode);
  function setMapping(idx: number, patch: Partial<WizardPayload["prefillMapping"][number]>) {
    setPayload((p) => {
      const next = [...p.prefillMapping];
      next[idx] = { ...next[idx], ...patch };
      return { ...p, prefillMapping: next };
    });
  }
  function addMapping() {
    setPayload((p) => ({
      ...p,
      prefillMapping: [
        ...p.prefillMapping,
        { field_kode: fieldKeys[0] ?? "", source: "profile.nama_lengkap" },
      ],
    }));
  }
  function removeMapping(i: number) {
    setPayload((p) => ({ ...p, prefillMapping: p.prefillMapping.filter((_, j) => j !== i) }));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section>
        <h3 className="mb-2 font-display font-bold">Ringkasan</h3>
        <dl className="space-y-1 text-sm">
          <Item label="Nama" value={payload.general.name || "—"} />
          <Item label="Kode" value={payload.general.code || "—"} />
          <Item label="Kategori" value={payload.general.category || "—"} />
          <Item label="SLA (hari)" value={payload.general.sla_days?.toString() ?? "—"} />
          <Item
            label="Tipe Pegawai"
            value={payload.employment.types.length ? payload.employment.types.join(", ") : "—"}
          />
          <Item label="Jumlah Field" value={String(payload.design.fields.length)} />
          <Item
            label="Multi submit"
            value={payload.permissions.allow_multiple_submit ? "Ya" : "Tidak"}
          />
        </dl>
      </section>
      <section>
        <h3 className="mb-2 font-display font-bold">Prefill Mapping (ASN)</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Pilih field yang akan otomatis terisi dari data profil ASN saat dibuka.
        </p>
        {payload.prefillMapping.length === 0 && (
          <p className="text-xs text-muted-foreground">Belum ada mapping.</p>
        )}
        <ul className="space-y-1">
          {payload.prefillMapping.map((m, i) => (
            <li key={i} className="flex items-center gap-1">
              <select
                className={`${inputCls} w-auto flex-1`}
                value={m.field_kode}
                onChange={(e) => setMapping(i, { field_kode: e.target.value })}
              >
                {fieldKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">←</span>
              <select
                className={`${inputCls} w-auto flex-1`}
                value={m.source}
                onChange={(e) =>
                  setMapping(i, { source: e.target.value as WizardPayload["prefillMapping"][number]["source"] })
                }
              >
                {SYSTEM_VARIABLES.filter((v) => v.startsWith("$current_user.")).map((v) => (
                  <option key={v} value={v.replace("$current_user.", "profile.")}>
                    {v}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeMapping(i)}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={addMapping}
          disabled={fieldKeys.length === 0}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs disabled:opacity-40"
        >
          + Tambah mapping
        </button>
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
