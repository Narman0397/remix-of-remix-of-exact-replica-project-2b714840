// Phase 1B.2 — Properties Panel (General / Validation / Conditional / Prefill).
// Visual builder, tanpa JSON editor.
import { useState, useMemo, useEffect } from "react";
import type {
  FieldType,
  FormField,
  FieldOption,
  FieldValidation,
  VisibleIfRule,
} from "@/features/forms/schema/types";
import { isPresentationalField } from "@/features/forms/schema/types";
import { slugifyKey } from "@/features/forms/wizard/types";
import { SYSTEM_VARIABLES } from "@/features/forms/services/form-prefill.service";
import { Trash2, Plus } from "lucide-react";

type Tab = "general" | "validation" | "conditional" | "prefill";

interface Props {
  field: FormField;
  allFields: FormField[];
  onChange: (next: FormField) => void;
  onAudit?: (ev: string) => void;
  readOnly?: boolean;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "general", label: "General" },
  { id: "validation", label: "Validation" },
  { id: "conditional", label: "Conditional" },
  { id: "prefill", label: "Prefill" },
];

export function PropertiesPanel(props: Props) {
  const [tab, setTab] = useState<Tab>("general");
  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={
              (t.id === "validation" || t.id === "conditional" || t.id === "prefill") &&
              isPresentationalField(props.field.tipe as FieldType)
            }
            className={`flex-1 px-2 py-2 text-xs font-medium ${
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-40`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === "general" && <GeneralTab {...props} />}
        {tab === "validation" && <ValidationTab {...props} />}
        {tab === "conditional" && <ConditionalTab {...props} />}
        {tab === "prefill" && <PrefillTab {...props} />}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

// ---------------- General ----------------
function GeneralTab({ field, onChange, readOnly }: Props) {
  const [keyTouched, setKeyTouched] = useState(false);
  const hasChoices =
    field.tipe === "dropdown" || field.tipe === "multi_select" || field.tipe === "radio";
  return (
    <div>
      <Row label="Label">
        <input
          className={inputCls}
          disabled={readOnly}
          value={field.label}
          onChange={(e) => {
            const label = e.target.value;
            const next: FormField = { ...field, label };
            if (!keyTouched && !isPresentationalField(field.tipe as FieldType)) {
              next.kode = slugifyKey(label);
            }
            onChange(next);
          }}
        />
      </Row>
      {!isPresentationalField(field.tipe as FieldType) && (
        <Row label="Field Key (snake_case)">
          <input
            className={inputCls}
            disabled={readOnly}
            value={field.kode}
            onChange={(e) => {
              setKeyTouched(true);
              onChange({ ...field, kode: e.target.value.replace(/[^a-z0-9_]/g, "") });
            }}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Field key tidak akan otomatis berubah setelah data tersimpan.
          </p>
        </Row>
      )}
      <Row label="Deskripsi / Help text">
        <textarea
          className={`${inputCls} min-h-[60px]`}
          disabled={readOnly}
          value={field.help_text ?? ""}
          onChange={(e) => onChange({ ...field, help_text: e.target.value || null })}
        />
      </Row>
      {!isPresentationalField(field.tipe as FieldType) && (
        <Row label="Placeholder">
          <input
            className={inputCls}
            disabled={readOnly}
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ ...field, placeholder: e.target.value || null })}
          />
        </Row>
      )}
      {!isPresentationalField(field.tipe as FieldType) && (
        <div className="mt-3 flex flex-wrap gap-3">
          <Toggle
            label="Required"
            disabled={readOnly}
            checked={field.required}
            onChange={(v) => onChange({ ...field, required: v })}
          />
        </div>
      )}
      {hasChoices && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Options
          </div>
          <OptionsEditor
            options={field.options}
            disabled={readOnly}
            onChange={(opts) => onChange({ ...field, options: opts })}
          />
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border"
      />
      <span>{label}</span>
    </label>
  );
}

function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: FieldOption[];
  onChange: (opts: FieldOption[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            className={`${inputCls} flex-1`}
            placeholder="Label"
            value={opt.label}
            disabled={disabled}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...next[i], label: e.target.value };
              if (!next[i].value) next[i].value = slugifyKey(e.target.value);
              onChange(next);
            }}
          />
          <input
            className={`${inputCls} w-24`}
            placeholder="value"
            value={opt.value}
            disabled={disabled}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...next[i], value: e.target.value.replace(/[^a-z0-9_]/g, "") };
              onChange(next);
            }}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="rounded p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...options, { value: `opsi_${options.length + 1}`, label: `Opsi ${options.length + 1}` }])}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Tambah opsi
        </button>
      )}
    </div>
  );
}

// ---------------- Validation ----------------
function ValidationTab({ field, onChange, readOnly, onAudit }: Props) {
  const v: FieldValidation = field.validation ?? {};
  function setV(patch: Partial<FieldValidation>) {
    onChange({ ...field, validation: { ...v, ...patch } });
    onAudit?.("field.update_validation");
  }
  const t = field.tipe as FieldType;
  const isText = t === "short_text" || t === "long_text" || t === "email" || t === "phone";
  const isNumber = t === "number" || t === "currency";
  const isFile = t === "file_upload";
  const isDate = t === "date" || t === "date_range";
  return (
    <div>
      {isText && (
        <>
          <Row label="Min Length">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.minLength ?? ""}
              onChange={(e) =>
                setV({ minLength: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
          <Row label="Max Length">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.maxLength ?? ""}
              onChange={(e) =>
                setV({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
          <Row label="Regex Pattern (opsional)">
            <input
              className={inputCls}
              disabled={readOnly}
              placeholder="contoh: ^[A-Z]{3}\\d{4}$"
              value={v.pattern ?? ""}
              onChange={(e) => setV({ pattern: e.target.value || undefined })}
            />
          </Row>
        </>
      )}
      {isNumber && (
        <>
          <Row label="Min">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.min ?? ""}
              onChange={(e) =>
                setV({ min: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
          <Row label="Max">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.max ?? ""}
              onChange={(e) =>
                setV({ max: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
        </>
      )}
      {isFile && (
        <>
          <Row label="MIME types (pisahkan dengan koma)">
            <input
              className={inputCls}
              disabled={readOnly}
              placeholder="application/pdf, image/*"
              value={(v.accept ?? []).join(", ")}
              onChange={(e) =>
                setV({
                  accept: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Row>
          <Row label="Max Size (MB)">
            <input
              type="number"
              className={inputCls}
              disabled={readOnly}
              value={v.maxSizeMb ?? ""}
              onChange={(e) =>
                setV({ maxSizeMb: e.target.value === "" ? undefined : Number(e.target.value) })
              }
            />
          </Row>
        </>
      )}
      {isDate && (
        <p className="text-xs text-muted-foreground">
          Date constraints (min/max date) akan dievaluasi runtime berdasarkan input user.
        </p>
      )}
      {!isText && !isNumber && !isFile && !isDate && (
        <p className="text-xs text-muted-foreground">
          Tipe ini tidak memerlukan aturan validasi tambahan.
        </p>
      )}
    </div>
  );
}

// ---------------- Conditional Logic ----------------
const COND_OPS: Array<{ value: VisibleIfRule extends infer R ? (R extends { op: infer O } ? O : never) : never; label: string }> = [
  { value: "eq" as const, label: "equals" },
  { value: "neq" as const, label: "not_equals" },
  { value: "contains" as const, label: "contains" },
  { value: "not_contains" as const, label: "not_contains" },
  { value: "gt" as const, label: "gt" },
  { value: "gte" as const, label: "gte" },
  { value: "lt" as const, label: "lt" },
  { value: "lte" as const, label: "lte" },
  { value: "filled" as const, label: "filled" },
  { value: "empty" as const, label: "empty" },
];

function ConditionalTab({ field, allFields, onChange, readOnly, onAudit }: Props) {
  const others = useMemo(
    () =>
      allFields.filter(
        (f) => f.kode !== field.kode && !isPresentationalField(f.tipe as FieldType),
      ),
    [allFields, field.kode],
  );
  const rule = field.visible_if;
  const enabled = !!rule;

  function setRule(next: VisibleIfRule) {
    onChange({ ...field, visible_if: next });
    onAudit?.("field.update_conditional");
  }

  return (
    <div>
      <Toggle
        label="Aktifkan conditional logic"
        disabled={readOnly}
        checked={enabled}
        onChange={(v) =>
          setRule(v ? { field: others[0]?.kode ?? "", op: "eq", value: "" } : null)
        }
      />
      {enabled && rule && (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            SHOW field ini JIKA
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              className={`${inputCls} w-auto`}
              disabled={readOnly}
              value={rule.field}
              onChange={(e) => setRule({ ...rule, field: e.target.value })}
            >
              {others.map((o) => (
                <option key={o.kode} value={o.kode}>
                  {o.label} ({o.kode})
                </option>
              ))}
            </select>
            <select
              className={`${inputCls} w-auto`}
              disabled={readOnly}
              value={rule.op}
              onChange={(e) =>
                setRule({ ...rule, op: e.target.value as NonNullable<VisibleIfRule>["op"] })
              }
            >
              {COND_OPS.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
            {rule.op !== "filled" && rule.op !== "empty" && (
              <input
                className={`${inputCls} w-auto flex-1`}
                placeholder="value"
                disabled={readOnly}
                value={Array.isArray(rule.value) ? rule.value.join(",") : (rule.value ?? "")}
                onChange={(e) => setRule({ ...rule, value: e.target.value })}
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Action: <strong>Show field</strong> (default). Untuk Hide/Require/Disable lihat
            preview &amp; runtime berikutnya.
          </p>
        </div>
      )}
      {!enabled && (
        <p className="mt-2 text-xs text-muted-foreground">
          Tidak ada aturan — field selalu ditampilkan.
        </p>
      )}
    </div>
  );
}

// ---------------- Prefill (per-field) ----------------
function PrefillTab({ field, onChange, readOnly }: Props) {
  // Prefill mapping disimpan di placeholder JSON (untuk MVP) atau
  // help_text? Lebih bersih: simpan di validation? Tidak ideal.
  // Pendekatan: simpan ke field.placeholder bila kosong, atau help_text.
  // Untuk MVP, expose sebagai info-only field — mapping global disimpan
  // di wizard payload (prefillMapping) yang dikelola di step Review.
  const [current, setCurrent] = useState<string>("");
  useEffect(() => setCurrent(""), [field.kode]);
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Pilih variabel sistem yang akan mengisi field ini secara otomatis saat dibuka oleh ASN.
        Mapping disimpan di tingkat form (lihat ringkasan di step Review).
      </p>
      <Row label="System Variable">
        <select
          className={inputCls}
          disabled={readOnly}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        >
          <option value="">— Tidak ada —</option>
          {SYSTEM_VARIABLES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Row>
      {current && (
        <button
          type="button"
          disabled={readOnly}
          onClick={() => {
            // Simpan sebagai default visualnya melalui placeholder hint.
            onChange({ ...field, placeholder: `{{${current}}}` });
          }}
          className="mt-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Set sebagai default value
        </button>
      )}
    </div>
  );
}
