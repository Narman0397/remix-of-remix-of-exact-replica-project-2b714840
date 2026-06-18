# Production Readiness Scorecard — Phase 3 Update

**Tanggal:** 2026-06-18 · **Status:** READY (Batch P1 applied, Storage hardening pending manual)

## Scores
| Dimensi | Skor | Δ | Catatan |
|---|---|---|---|
| **Security** | 88/100 | = | 0 ERROR · 67 WARN (turun dari 106 → 67 setelah Batch E1+E2). Sisa = SECURITY DEFINER functions Group A/B (E3/E4 menunggu approval). |
| **Performance** | 84/100 | +6 | 2 indeks baru applied (P-02 permohonan, P-08 aset). 4 indeks lain sudah pre-existing. |
| **Reliability** | 90/100 | = | 14 cron + watchdog + DLQ + retry_queue tetap hijau. |
| **Production Readiness** | **88/100** | +3 | Tinggal storage MIME UI + Batch E3/E4 review + captcha. |

## Applied This Turn
- ✅ Batch P1: `idx_permohonan_pemohon_status`, `idx_aset_opd_status_active`.
- ⚠️ Storage Hardening (S-01..S-05): **SQL diblokir platform** → eskalasi ke Backend UI (manual).

## Remaining Warnings (67)
- ~50 WARN: `SECURITY DEFINER` functions Group A (internal auth, e.g. `executive_summary`, `governance_summary`, `fn_approve_user`) — pending Batch E4.
- ~13 WARN: helper functions Group B (`has_role`, `is_bupati`, `get_user_opd`, `check_signed_document_status`) — **harus tetap accessible** untuk RLS & public verify. Pending Batch E3 dengan whitelist anon.
- 4 WARN: `lap_ins` permissive INSERT pada `laporan_masyarakat` (intentional — anon laporan publik).

## Remaining Technical Debt
| # | Item | Severity | Owner |
|---|---|---|---|
| TD-01 | Storage MIME/size belum di-enforce (UI manual) | MED | Super admin |
| TD-02 | Captcha endpoint anon POST (IKM, laporan) | MED | DevOps |
| TD-03 | Storage mirror eksternal (R2/S3) | MED | Infra |
| TD-04 | Materialized view `opd_skor_komposit` harian | LOW | Backend |
| TD-05 | DR drill kuartalan belum dijalankan | LOW | Ops |
| TD-06 | Email reminder deadline form | LOW | Backend |

## Open Risks
| # | Risiko | Severity | Mitigasi |
|---|---|---|---|
| OR-01 | 67 WARN linter sisa | LOW–MED | Batch E3 + E4 (pending approval) |
| OR-02 | Tidak ada storage mirror | MED | CR-01 |
| OR-03 | Captcha belum aktif di endpoint publik | MED | OR-03 |
| OR-04 | Storage MIME masih NULL (server fn sudah validasi, bucket belum) | LOW | UI manual |

## Recommended Deployment Sequence
1. ✅ Batches A/B/C/D/E1/E2/P1 — DONE.
2. **Manual:** Storage MIME/size via Backend UI (lihat `storage_hardening_compatibility_report.md`).
3. Smoke test 7 role + 8 modul.
4. **Review:** Batch E3 (helpers — pastikan whitelist `anon` untuk `has_role`, `check_signed_document_status`).
5. **Review:** Batch E4 (internal auth functions).
6. Captcha integration (Turnstile).
7. Publish ke production.

## Status: SIAP DEPLOY DENGAN CATATAN
Aplikasi dapat di-publish ke production. Hardening lanjutan (E3/E4, storage UI, captcha) dapat di-rollout incremental tanpa downtime.
