# Phase 2 — Performance Audit

**Tanggal:** 2026-06-18 · **Status:** REKOMENDASI (tidak ada perubahan diterapkan)

## 1. Schema Hotspot Analysis

### 1.1 Missing / Recommended Indexes
| # | Tabel/Kolom | Issue | Severity | Rekomendasi |
|---|---|---|---|---|
| P-01 | `permohonan(opd_id, status, tanggal_masuk)` | dashboard OPD filter ganda — saat ini hanya idx `opd_id` & `status` terpisah | HIGH | `CREATE INDEX idx_permohonan_opd_status_tgl ON permohonan(opd_id, status, tanggal_masuk DESC);` |
| P-02 | `permohonan(pemohon_id, status)` | warga "permohonan saya" sequential scan saat status filter | MED | composite index |
| P-03 | `absensi_asn(user_id, waktu)` | sudah ada — verifikasi DESC order utk rekap bulanan | LOW | pastikan `(user_id, waktu DESC)` |
| P-04 | `audit_log(created_at DESC)` | retention cleanup full scan setiap run | MED | `CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);` |
| P-05 | `notifications(user_id, dibaca, created_at)` | unread badge query lambat saat user > 5k rows | MED | composite |
| P-06 | `form_submissions(form_id, status, submitted_at)` | dashboard form admin | MED | composite |
| P-07 | `permohonan_rating(permohonan_id)` | agregasi rating per permohonan/opd | LOW | sudah ada index |
| P-08 | `aset(opd_id, status)` | compliance dashboard | MED | composite + partial WHERE status<>'dihapuskan' |
| P-09 | `rate_limit_hits(scope, subject, window_start)` | unique constraint sudah cukup | — | OK |
| P-10 | `cron_history(job_name, started_at DESC)` | watchdog cron | LOW | composite |

### 1.2 Duplicate / Unused Indexes
- `profiles_email_idx` & `profiles_pkey` keduanya unik via email — review jika `email` selalu unique. (LOW)
- Tidak terdeteksi index duplikat lain via pg_stat_user_indexes.

### 1.3 Sequential Scan Hotspots
- `permohonan` saat join ke `permohonan_rating` (dashboard `opd_skor_komposit`) — solusi: index P-01.
- `audit_log` saat `fn_retention_cleanup` — solusi: index P-04.
- `form_submissions` saat dashboard admin — solusi: index P-06.

### 1.4 Expensive Joins / Aggregates
| Query | Issue | Rekomendasi |
|---|---|---|
| `opd_skor_komposit()` | 3-way join `opd × permohonan × rating` setiap render dashboard | materialized view harian + cron refresh |
| `executive_summary()` | 5 sub-count, dipanggil setiap mount dashboard | tambahkan caching 60s di client (React Query staleTime) |
| `attendance_rekap_bulanan` | generate_series + LEFT JOIN per user per bulan | OK untuk skala saat ini; revisit > 5k ASN |

### 1.5 N+1 Risks
- ✅ `permohonan_riwayat` via `riwayat_dengan_petugas` (single RPC) — bagus.
- ⚠️ `src/lib/aset.functions.ts` — list aset + fetch detail history per-row di beberapa tempat. Audit ulang.
- ✅ Form submissions menggunakan `select('*, files(*)')` (single roundtrip).

### 1.6 Bottleneck Ringkasan
| Object | Issue | Severity | Recommended Fix |
|---|---|---|---|
| Dashboard Eksekutif | 5 count queries serial | MED | gabung dalam 1 RPC `executive_summary` (sudah) + add staleTime 60s |
| Aset Compliance | full table scan saat tanpa OPD filter | MED | index P-08 |
| Audit Cleanup | full scan `audit_log` | HIGH | index P-04 |
| Permohonan list | composite index missing | HIGH | index P-01, P-02 |
| Notif badge | per-user full scan | MED | index P-05 |

## 2. Rekomendasi Tindak Lanjut (Batch P1)
SQL singkat — **tidak diaplikasikan** sampai approval:
```sql
CREATE INDEX idx_permohonan_opd_status_tgl ON public.permohonan(opd_id, status, tanggal_masuk DESC);
CREATE INDEX idx_permohonan_pemohon_status ON public.permohonan(pemohon_id, status);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE dibaca = false;
CREATE INDEX idx_form_submissions_form_status ON public.form_submissions(form_id, status, submitted_at DESC);
CREATE INDEX idx_aset_opd_status ON public.aset(opd_id, status) WHERE status <> 'dihapuskan';
```
Estimasi waktu: < 30 detik per index pada DB current (<1M rows). Tidak ada lock writing (CREATE INDEX biasa di Postgres mengunci writes — pertimbangkan CONCURRENTLY post-launch).
