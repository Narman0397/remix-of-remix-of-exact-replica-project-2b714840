// Phase 1B.2 — Default factories per FieldType untuk palette → canvas.
import type { FieldType, FormField } from "@/features/forms/schema/types";
import { slugifyKey } from "@/features/forms/wizard/types";

export interface PaletteItem {
  type: FieldType;
  label: string;
  group: "input" | "choice" | "media" | "layout";
  description?: string;
}

export const PALETTE: PaletteItem[] = [
  { type: "short_text", label: "Text", group: "input" },
  { type: "long_text", label: "Textarea", group: "input" },
  { type: "number", label: "Number", group: "input" },
  { type: "currency", label: "Currency", group: "input" },
  { type: "email", label: "Email", group: "input" },
  { type: "phone", label: "Phone", group: "input" },
  { type: "date", label: "Date", group: "input" },
  { type: "date_range", label: "Date Range", group: "input" },
  { type: "dropdown", label: "Select", group: "choice" },
  { type: "multi_select", label: "Multi Select", group: "choice" },
  { type: "radio", label: "Radio", group: "choice" },
  { type: "checkbox", label: "Checkbox", group: "choice" },
  { type: "file_upload", label: "File Upload", group: "media" },
  { type: "signature", label: "Signature", group: "media" },
  { type: "heading", label: "Heading", group: "layout" },
  { type: "section", label: "Section", group: "layout" },
  { type: "divider", label: "Divider", group: "layout" },
];

export const GROUP_LABEL: Record<PaletteItem["group"], string> = {
  input: "Input",
  choice: "Pilihan",
  media: "Media",
  layout: "Layout",
};

const DEFAULT_LABELS: Partial<Record<FieldType, string>> = {
  short_text: "Teks",
  long_text: "Paragraf",
  number: "Angka",
  currency: "Nominal (Rp)",
  email: "Email",
  phone: "Nomor HP",
  date: "Tanggal",
  date_range: "Rentang Tanggal",
  dropdown: "Pilihan",
  multi_select: "Pilihan (banyak)",
  radio: "Opsi",
  checkbox: "Persetujuan",
  file_upload: "Lampiran",
  signature: "Tanda Tangan",
  heading: "Judul Bagian",
  section: "Section",
  divider: "Pembatas",
};

export function createFieldOfType(type: FieldType, existingKeys: Set<string>): FormField {
  const label = DEFAULT_LABELS[type] ?? "Field";
  const base = slugifyKey(label);
  let kode = base;
  let n = 2;
  while (existingKeys.has(kode)) kode = `${base}_${n++}`;

  const opts =
    type === "dropdown" || type === "multi_select" || type === "radio"
      ? [
          { value: "opsi_1", label: "Opsi 1" },
          { value: "opsi_2", label: "Opsi 2" },
        ]
      : [];

  return {
    kode,
    label,
    tipe: type,
    required: false,
    placeholder: null,
    help_text: null,
    options: opts,
    validation:
      type === "file_upload"
        ? { maxSizeMb: 5, accept: ["application/pdf", "image/*"] }
        : {},
    visible_if: null,
    urutan: 0,
  };
}
