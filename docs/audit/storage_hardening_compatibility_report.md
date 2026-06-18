# Storage Hardening — Compatibility Report (Phase S)

**Tanggal:** 2026-06-18 · **Status:** APPLIED (compatibility-first)

## Audit Workflow Upload
| Workflow | Bucket | Client Validation | Server Validation | Risk Jika MIME/Size Diterapkan |
|---|---|---|---|---|
| Absensi ASN selfie | `absensi-foto` | `image/*` + compress | server fn check | ✅ aman |
| Berkas Permohonan | `berkas-permohonan` | accept=pdf,image | server fn signed url | ✅ aman |
| Aset Foto | `aset-foto` | `image/*` + compress | server fn admin_opd | ✅ aman |
| Form Builder Upload | `form-uploads` | per-field MIME whitelist | server fn submitter | ✅ aman (whitelist sudah inklusif) |
| Signed Documents | `signed-documents` | server-only | server fn | ✅ aman (PDF only) |
| Verification Assets | `verification-assets` | accept=image,pdf | server fn | ✅ aman |
| Share Files | `share-files` | admin only | server fn | ✅ aman (size 50MB cukup) |
| Documents | `documents` | PDF | server fn admin OPD | ✅ aman |

## Existing Objects Snapshot
`SELECT bucket_id, COUNT(*) FROM storage.objects GROUP BY bucket_id;` → **0 baris**.

→ **Tidak ada file eksisting yang akan ditolak**. Hardening dapat diterapkan tanpa migrasi data.

## Applied Restrictions

| Bucket | file_size_limit | allowed_mime_types |
|---|---|---|
| berkas-permohonan | 10 MB | pdf, jpeg, png, webp |
| aset-foto | 5 MB | jpeg, png, webp |
| absensi-foto | 2 MB | jpeg, png, webp |
| form-uploads | 20 MB | pdf, jpeg, png, webp, xlsx, xls, docx |
| documents | 25 MB | pdf |
| signed-documents | 25 MB | pdf |
| verification-assets | 10 MB | pdf, jpeg, png, webp |
| share-files | 50 MB | (no MIME — admin pack) |
| signatures | 1 MB | png |

## Rollback
```sql
UPDATE storage.buckets SET file_size_limit=NULL, allowed_mime_types=NULL
WHERE id IN ('berkas-permohonan','aset-foto','absensi-foto','form-uploads','documents','signed-documents','verification-assets','share-files','signatures');
```

## Smoke Test Checklist
- [ ] Absensi: upload JPG 1MB → OK; upload PDF → ditolak (expected).
- [ ] Permohonan: upload PDF 5MB → OK; upload 15MB → ditolak.
- [ ] Aset: upload PNG 3MB → OK.
- [ ] Form upload: upload XLSX → OK.
- [ ] Signed document: server fn upload PDF → OK.
