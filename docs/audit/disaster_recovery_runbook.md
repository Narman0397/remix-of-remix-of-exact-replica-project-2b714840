# Phase 5 — Backup & Disaster Recovery Runbook

**Tanggal:** 2026-06-18 · **Status:** RUNBOOK

## 1. Database
### Backup
- **PITR:** aktif di Lovable Cloud (retention 7 hari di plan saat ini; dapat di-upgrade).
- **Daily snapshot:** Lovable Cloud managed, retensi 7 hari.
- **App-level snapshot:** cron `backup-snapshot` → tabel `backup_snapshot` (metadata + manifest objek storage).

### Recovery
1. **Point-in-time (≤ 7 hari):** hubungi support Lovable Cloud → minta restore ke timestamp X.
2. **Restore parsial dari `backup_snapshot`:** baca manifest → re-insert via migration (tooling SQL manual).
3. **Tes recovery quarterly:** clone project ke staging, jalankan restore drill, ukur RTO.

| Metrik | Target | Saat ini |
|---|---|---|
| RPO (data loss max) | 5 menit | ✅ PITR |
| RTO (waktu pulih) | 60 menit | ⚠️ belum diukur — drill dibutuhkan |

## 2. Storage
### Backup
- Lovable Cloud Storage tidak memiliki snapshot otomatis.
- Cron `backup-snapshot` mencatat **manifest** (id + path + checksum) tetapi tidak menyalin blob.

### Recovery
1. Hilangnya objek tunggal: re-upload via Admin UI atau restore dari arsip user.
2. Hilangnya bucket: kontak Lovable support — bucket recreate + permission policy via migration di repo (`supabase/migrations/`).

### Rekomendasi
- **CR-01 (MED):** tambahkan cron `storage-mirror` → salin bucket `signed-documents` & `documents` ke object storage eksternal (S3/R2) mingguan.
- **CR-02 (LOW):** hitung checksum sha256 tiap upload (sudah ada via `upload-integrity`) — simpan ke `documents.sha256` untuk verifikasi.

## 3. Secrets
### Inventory (Lovable Cloud Secrets)
- `LOVABLE_API_KEY` (managed, rotasi via tool)
- `SUPABASE_SERVICE_ROLE_KEY` (managed Lovable Cloud)
- `SUPABASE_PUBLISHABLE_KEY` (public)
- `CRON_SECRET` (custom)
- `SUPABASE_DB_URL` (managed)

### Rotasi
| Secret | Frekuensi | Prosedur |
|---|---|---|
| `LOVABLE_API_KEY` | tahunan / kompromi | `lovable_api_key--rotate_lovable_api_key` |
| `CRON_SECRET` | tahunan | `secrets--update_secret` + perbarui cron job header di pg_cron (`cron.schedule(...)`) |
| `SUPABASE_SERVICE_ROLE_KEY` | tahunan / kompromi | `supabase--rotate_api_keys` (downtime ~1 menit) |

### Backup
- Secrets disimpan di Lovable Cloud — tidak ada ekspor manual. Catat checksum/last-rotated di password manager internal tim.

## 4. Recovery Runbook (Incident Playbook)

### Skenario A: Data corruption (e.g. salah UPDATE besar)
1. Identifikasi waktu T0 sebelum incident (cek `audit_log` & cron history).
2. Buat snapshot saat ini (untuk forensik).
3. Request PITR ke T0-5min via Lovable support.
4. Validasi via smoke test → role super_admin akses dashboard utama.

### Skenario B: Storage object hilang
1. Cek `dead_letter_jobs` & `upload-integrity` history → identifikasi file.
2. Restore dari user re-upload atau mirror eksternal (post CR-01).
3. Update `documents.status='restored'` + log audit.

### Skenario C: Secret kompromi
1. Rotasi via tool (LOVABLE_API_KEY / CRON_SECRET).
2. Update pg_cron headers.
3. Force logout semua sesi: `auth.users` → invalidate refresh tokens (manual SQL).
4. Audit `auth.audit_log_entries` 24 jam terakhir.

### Skenario D: Full project loss
1. Restore project skeleton dari git repo (TanStack + migration history).
2. Lovable Cloud: provision new project, run all migration `supabase/migrations/` berurutan.
3. Restore secrets dari password manager.
4. Restore DB dari snapshot (jika eksis) atau accept data loss.
5. Restore storage (jika mirror eksternal ada).

## 5. Drill Schedule
| Drill | Frekuensi | PIC | Last Run |
|---|---|---|---|
| PITR restore (staging) | Quarterly | Ops | — TBD |
| Storage mirror restore | Semi-annual | Ops | — TBD |
| Secret rotation | Annual | Security | — TBD |
| Full DR (skenario D) | Annual | Eng Lead | — TBD |
