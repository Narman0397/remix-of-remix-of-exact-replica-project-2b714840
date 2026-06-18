# Phase 4 — Cron Verification

**Tanggal:** 2026-06-18 · **Status:** REVIEW

Semua cron job hit endpoint `/api/public/hooks/*` dan verifikasi `x-cron-secret` (atau header `apikey` anon) di handler. Database client = `supabaseAdmin` (service_role).

## Matrix
| Cron Job | Schedule | Endpoint | Auth | Service Role | Error Handling | Retry | Logging | Risk | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| aset-susut-bulanan | `0 1 1 * *` | `/api/public/hooks/aset-susut-bulanan` | ✅ CRON_SECRET | ✅ | try/catch | via retry-queue | cron_history | LOW | OK |
| aset-warranty-reminder | `0 7 * * *` | `/api/public/hooks/aset-warranty-reminder` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| assignment-reminder | `0 8 * * 1-5` | `/api/public/hooks/assignment-reminder` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| backup-snapshot | `0 0 * * *` | `/api/public/hooks/backup-snapshot` | ✅ | ✅ | ✅ | dead_letter | ✅ | LOW | OK |
| cleanup-uploads | `0 3 * * *` | `/api/public/hooks/cleanup-uploads` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| cron-watchdog | `*/15 * * * *` | `/api/public/hooks/cron-watchdog` | ✅ | ✅ | ✅ | — | ✅ alert | LOW | OK |
| form-deadline-reminder | `0 9 * * *` | `/api/public/hooks/form-deadline-reminder` | ✅ | ✅ | ✅ | — | ✅ | LOW | tambah email channel (MF-03) |
| retention-cleanup | `0 2 * * 0` | `/api/public/hooks/retention-cleanup` | ✅ | ✅ via `fn_retention_cleanup` (service_role only post Batch B) | ✅ | — | ✅ | LOW | OK |
| retry-queue | `*/5 * * * *` | `/api/public/hooks/retry-queue` | ✅ | ✅ | ✅ | exponential backoff | ✅ | LOW | OK |
| sla-escalation | `*/30 * * * *` | `/api/public/hooks/sla-escalation` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| sla-reminder | `0 */2 * * *` | `/api/public/hooks/sla-reminder` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| storage-cleanup | `0 4 * * 0` | `/api/public/hooks/storage-cleanup` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| stuck-jobs | `*/10 * * * *` | `/api/public/hooks/stuck-jobs` | ✅ | ✅ | ✅ | — | ✅ | LOW | OK |
| upload-integrity | `0 5 * * *` | `/api/public/hooks/upload-integrity` | ✅ | ✅ | ✅ | dead_letter | ✅ | LOW | OK |

## Summary
- ✅ Semua 14 cron menggunakan service_role + secret.
- ✅ Watchdog memonitor cron lain (cron_history table + alert via notifications).
- ✅ Dead-letter pattern dipakai untuk job kritikal (backup, upload-integrity).
- ✅ Pasca Batch B, `fn_retention_cleanup` & `fn_susut_bulanan_run` & `rate_limit_increment` hanya bisa dipanggil service_role.

## Rekomendasi
- LOW: tambahkan structured logging (JSON) ke `cron_history.detail` agar mudah di-query.
- LOW: alert webhook (Slack/Discord) bila watchdog mendeteksi >2 failure beruntun.
