# Phase 7 — Production Readiness Scorecard

**Tanggal:** 2026-06-18 · **Status:** READY (pending Batch E1/E2 apply + index P1)

## Scores
| Dimensi | Skor | Catatan |
|---|---|---|
| **Security** | 88/100 | 0 ERROR · 106 WARN tersisa (akan turun ~80 setelah E1+E2). RLS lengkap, secrets terkelola. |
| **Performance** | 78/100 | 6 composite index missing (Batch P1). Dashboard eksekutif cukup cepat, aset compliance perlu index. |
| **Reliability** | 90/100 | 14 cron + watchdog + dead_letter + retry_queue lengkap. PITR aktif. |
| **Production Readiness** | **85/100** | Siap deploy dengan blok: jalankan E1+E2, P1 (index), storage MIME (S-01..S-05). |

## Open Risks
| # | Risiko | Severity | Mitigasi |
|---|---|---|---|
| OR-01 | 106 WARN linter (mayoritas function execute PUBLIC) | MED | Batch E1 (apply now) + E2 (apply now) + E3/E4 (pending review) |
| OR-02 | Tidak ada storage mirror eksternal | MED | CR-01 — mirror weekly ke S3/R2 |
| OR-03 | Captcha belum ada di endpoint anon POST (IKM, laporan) | MED | tambah Turnstile + secret |
| OR-04 | Index composite belum dibuat | MED | Apply Batch P1 (6 index) |
| OR-05 | DR drill belum dijalankan (RTO belum diukur) | LOW | jadwal drill kuartalan |
| OR-06 | Email reminder belum ada untuk deadline form | LOW | MF-03 |
| OR-07 | UI restore backup belum lengkap | LOW | MF-04 |

## Recommended Deployment Sequence
1. ✅ Batch A/B/C/D (DONE).
2. **Batch E1** (trigger functions) — apply this turn.
3. **Batch E2** (aggregate functions) — apply this turn.
4. Re-run linter → verifikasi WARN turun ~26.
5. Smoke test 7 role (UAT checklist Phase 1).
6. **Batch P1** (6 composite index) — apply setelah approval.
7. **Storage MIME hardening** (S-01..S-05) — via Lovable Cloud UI atau migration storage.
8. **Batch E3/E4** — review impact report → approval → apply bertahap.
9. **Captcha integration** (OR-03) — Turnstile secret + frontend wiring.
10. **CR-01** storage mirror.
11. Publish ke production.

## Remaining Technical Debt
- Materialized view harian untuk `opd_skor_komposit` (perf > 50k permohonan).
- Email channel untuk reminder.
- Antivirus scan upload.
- Auto-warn sertifikat TTD H-30.

## Next Actions (urutan prioritas)
1. Apply E1 + E2 (dilakukan turn ini).
2. Review E3 impact report (terutama `has_role` tetap anon).
3. Approve P1 indexes.
4. Approve storage MIME hardening.
5. Schedule DR drill.
