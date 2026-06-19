## Phase 3A — Document Runtime & Generation Engine

### Audit hasil

Tabel existing yang akan dipakai (TANPA ubah konsep):
- `document_templates` (id, form_id, owner_opd_id, name, description, template_html, template_storage_path, variables jsonb, status, audit cols)
- `generated_documents` (id, submission_id, template_id, storage_path, mime, size_bytes, signed_document_id, generated_at, generated_by)
- `submission_versions`, `form_versions`, `workflow_versions` → sumber snapshot
- `nomor_surat_sequence` + `nomor_surat_issued` + RPC `fn_generate_nomor_surat` → numbering existing per-OPD (akan dipakai sebagai engine inti; rule baru untuk format custom per-jenis-dokumen)

### Migration baru (minimal, additive)

1. `document_templates` — tambah kolom:
   - `kind text not null default 'html'` (`html` | `docx` | `pdf`)
   - `category text` (jenis dokumen, dipakai numbering rule)
   - `current_version int not null default 1`
   - `numbering_rule_id uuid` (FK → document_numbering_rules)
2. `document_template_versions` (baru, immutable snapshot):
   - id, template_id, version_number, kind, template_html, template_storage_path, variables jsonb, created_by, created_at, UNIQUE(template_id, version_number)
3. `generated_documents` — tambah kolom:
   - `doc_number text` (unique partial), `name text`, `status text default 'generated'` (draft|generated|pending_signature|signed|rejected|archived), `template_version int`, `snapshot jsonb default '{}'`, `archived_at timestamptz`, `numbering_rule_id uuid`
4. `document_numbering_rules` (baru):
   - id, code, name, format text (`PB-{YEAR}-{SEQ}` / `800/{SEQ}/{OPD}/{YEAR}`), scope text (`global`|`per_opd`|`per_category`|`per_opd_category`), category text, opd_id uuid, reset_period text (`yearly`|`never`), padding int default 6, status text, audit
5. `document_numbering_sequences` (baru): rule_id, scope_key text, year int, last_number int, UNIQUE(rule_id, scope_key, year) + RPC `fn_doc_next_number(rule_id, opd_id, category)`
6. `document_history` (baru): id, document_id, action text (created|generated|downloaded|archived|sent_for_signature|signed|rejected), actor_id, metadata jsonb, created_at
7. Storage bucket `documents` (private) untuk hasil generate; bucket `document-templates` (private) untuk DOCX/PDF template raw
8. GRANTs + RLS lengkap (admin/operator OPD/pemohon mengikuti submission RLS)

### Server services (`src/features/documents/services/`)
- `document-template.service.ts` — CRUD + clone + publish + snapshot version
- `document-numbering.service.ts` — resolve rule → call RPC → format string
- `document-generator.service.ts` — load template snapshot + submission snapshot + workflow snapshot → merge → render PDF/DOCX/HTML
- `document-preview.service.ts` — merge tanpa persist (returns HTML preview)
- `document-archive.service.ts` — archive/restore + history
- `placeholder-engine.ts` — parser `{{a.b.c}}` dengan source map (submission/profile/workflow/system)
- `placeholder-catalog.ts` — daftar placeholder per kategori untuk picker

### Server functions (`src/lib/documents.functions.ts`)
docListTemplates, docGetTemplate, docCreateTemplate, docUpdateTemplate, docCloneTemplate, docArchiveTemplate, docPublishTemplate, docPreview, docGenerate, docListDocuments, docGetDocument, docArchiveDocument, docDownloadDocument (signed URL), docListNumberingRules, docCreateNumberingRule, docUpdateNumberingRule, docArchiveNumberingRule, docPreviewNumbering, docPlaceholderCatalog.

Semua pakai `requireSupabaseAuth`. Audit ke `audit_log` (`document.template.*`, `document.generated`, `document.number.assigned`, `document.archived`, `document.downloaded`).

### Generation engine
- **HTML**: template_html + Handlebars-like merge → simpan sebagai `.html`
- **PDF**: render HTML → PDF via `@react-pdf/renderer` tidak cocok untuk HTML arbitrer → pakai **pdf-lib + html sederhana** ATAU pendekatan: generate HTML, lalu konversi via worker-friendly lib. Karena Cloudflare Worker tidak mendukung headless Chromium, gunakan **`pdfmake`** (pure JS, worker-safe) untuk PDF dari struktur Doc Definition; untuk template HTML kompleks → render server-side ke pdfmake doc def via mapping sederhana, atau simpan HTML + sajikan print-view (browser print → PDF).
  - Keputusan: HTML template → server hasilkan HTML final + simpan; PDF dihasilkan via `pdfmake` dari `template_html` yang sudah di-merge (heading/paragraph/table sederhana). Cukup untuk surat resmi.
- **DOCX**: pakai `docx` (npm, worker-safe pure JS) dengan templating placeholder pada paragraph; untuk template DOCX upload → gunakan `docxtemplater` + `pizzip` (worker-compatible, pure JS).
- File hasil → upload ke bucket `documents/<submission_id>/<doc_id>.<ext>`

### Auto numbering
- Rule format tokens: `{YEAR}`, `{SEQ}`, `{OPD}`, `{OPD_CODE}`, `{CATEGORY}`, `{MONTH}`
- Scope key dihitung berdasarkan `scope` rule → query/insert `document_numbering_sequences` atomic via RPC `fn_doc_next_number` (SECURITY DEFINER + advisory lock)
- Preview tanpa increment

### UI (routes `_authenticated/admin/documents/*`)
```
/admin/documents               → landing (cards)
/admin/documents/templates     → list + filter + create
/admin/documents/templates/$id → editor (meta, type, content, placeholder picker, version history, preview)
/admin/documents/generated     → list + filters (status, OPD, jenis, tanggal, workflow) + view + download + archive
/admin/documents/numbering     → rules CRUD + preview
/admin/documents/archive       → search archived + history + metadata
```
Sidebar AdminShell menu group baru **Document Center** → Templates, Generated, Numbering, Archive.

Komponen:
- `TemplateEditor` (tabs: Meta | Content | Placeholders | Preview | Versions)
- `PlaceholderPicker` (4 kategori, click-to-insert)
- `DocumentPreviewPanel` (desktop & print view, iframe srcDoc)
- `NumberingRuleEditor` + `NumberingPreview`
- `GenerateDocumentDialog` (pilih template → preview → generate)

Trigger generate juga tersedia dari **Task Detail** Phase 2B (tombol "Generate Dokumen") setelah approval.

### Audit & RLS
- RLS: `document_templates` (admin/operator OPD owner), `generated_documents` (mengikuti submission policies: pemohon, operator OPD, admin OPD, super admin via `has_role`), `document_numbering_rules` (admin only)
- Semua mutasi tulis ke `audit_log` + `document_history`
- Tidak ada cek role di UI; gunakan server-side `has_role`

### Constraints
- Snapshot wajib: generated_documents.snapshot menyimpan `{ submission, workflow, profile, template_version }`
- Immutable: update generated_documents hanya field status/archived
- Tidak ada `any`, semua strict types
- Tidak menyentuh Form Builder & Workflow Runtime (hanya tombol generate ditambahkan di task detail)

### NPM packages
- `docxtemplater`, `pizzip`, `pdfmake`, `handlebars` (worker-safe, pure JS)

### Estimasi file
- ~7 migration SQL blocks (1 file)
- ~8 service files
- ~1 server-functions file
- ~10 route/komponen UI

Setelah disetujui saya akan eksekusi end-to-end dalam batch paralel.