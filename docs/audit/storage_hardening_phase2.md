# Phase 3 — Storage Hardening Audit

**Tanggal:** 2026-06-18 · **Status:** REKOMENDASI

## Audit per Bucket
Semua bucket **private** (public=false) ✅.

| Bucket | MIME Restriction | Size Limit | Upload Policy | Download Policy | Ownership | Catatan |
|---|---|---|---|---|---|---|
| berkas-permohonan | ⚠️ tidak di-bucket config | ⚠️ tidak di-bucket | auth + owner path | signed URL via server fn | ✅ folder `pemohon_id/...` | enforce MIME `application/pdf,image/*` + 10MB |
| aset-foto | ⚠️ none | ⚠️ none | admin_opd scope | signed URL | folder `opd_id/aset_id/` | enforce `image/*` + 5MB |
| absensi-foto | ✅ `image/*` | ✅ 2MB | ASN owner | signed URL ASN+admin | folder `user_id/yyyy-mm/` | OK |
| form-uploads | ⚠️ none | ⚠️ none | submitter owner | signed URL | folder `submission_id/` | enforce MIME whitelist + 20MB |
| share-files | ⚠️ none | ⚠️ none | admin scope | signed URL + expiry | folder `paket_id/` | enforce dynamic expiry max 30d |
| signatures | ✅ `image/png` | ✅ 1MB | owner only | server-side only | folder `user_id/` | OK |
| documents | ⚠️ none | ⚠️ none | admin OPD | signed URL | folder `opd_id/doc_id/` | enforce `application/pdf` |
| signed-documents | ✅ `application/pdf` | ✅ 25MB | server fn only | signed URL + verify token | folder `doc_id/` | OK |
| verification-assets | ✅ `image/*,application/pdf` | ✅ 10MB | authenticated upload | admin verifikasi only | folder `user_id/` | OK |
| (branding, pejabat-foto) | belum dibuat | — | — | — | — | jika diperlukan: public+CDN |

## Temuan
| ID | Bucket | Issue | Severity | Fix |
|---|---|---|---|---|
| S-01 | berkas-permohonan | tidak ada MIME/size guard di bucket config | HIGH | `UPDATE storage.buckets SET file_size_limit=10485760, allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'] WHERE id='berkas-permohonan';` |
| S-02 | aset-foto | sama | HIGH | size 5MB + `image/*` |
| S-03 | form-uploads | sama, tetapi field renderer sudah validasi client-side | MED | size 20MB + whitelist |
| S-04 | share-files | tanpa MIME/size | MED | size 50MB |
| S-05 | documents | tanpa MIME | MED | `application/pdf` |
| S-06 | semua | tidak ada antivirus scan | LOW | optional: queue ClamAV worker |
| S-07 | semua | tidak ada lifecycle/auto-delete | MED | cron `storage-cleanup` sudah handle orphan; tambahkan retention per-bucket |

## Validasi Saat Ini
- ✅ Semua bucket private (tidak ada public CDN bocor)
- ✅ Signed URL TTL ≤ 1 jam (`createSignedUrl(60*60)`)
- ✅ RLS storage.objects per bucket (folder owner)
- ✅ Server fn upload selalu via `supabaseAdmin` setelah cek owner
- ✅ Cron `storage-cleanup` & `cleanup-uploads` & `upload-integrity` aktif

## Rekomendasi Migration (tidak diterapkan)
```sql
UPDATE storage.buckets SET file_size_limit=10485760,
  allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp']
  WHERE id='berkas-permohonan';
UPDATE storage.buckets SET file_size_limit=5242880,
  allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
  WHERE id='aset-foto';
UPDATE storage.buckets SET file_size_limit=20971520,
  allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel']
  WHERE id='form-uploads';
UPDATE storage.buckets SET file_size_limit=52428800 WHERE id='share-files';
UPDATE storage.buckets SET file_size_limit=26214400,
  allowed_mime_types=ARRAY['application/pdf']
  WHERE id='documents';
```
**Catatan:** modifikasi `storage.*` schema dibatasi — perlu UI Lovable Cloud / Project Settings → Storage. Sertakan instruksi manual jika auto-migrate ditolak.
