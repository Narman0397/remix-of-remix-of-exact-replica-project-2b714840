# Function Privilege Matrix — SECURITY DEFINER Functions

**Tanggal:** 2026-06-18 (post Batch A/B/C/D)
**Tujuan:** Audit lengkap semua fungsi `SECURITY DEFINER` di schema `public` untuk persiapan Batch E.
**Status:** REVIEW — tidak ada perubahan diterapkan.

## Legend
- **Current Grants:** ringkasan ACL aktual (selain `postgres`/`sandbox_exec` yang selalu ada).
- **Used By:** lokasi pemanggil (frontend page, server fn, trigger, cron).
- **Recommended Grants:** target Batch E.
- **Risk:** LOW/MED/HIGH bila grant publik dipertahankan.

---

## Group 0 — Sudah di-Hardening (Batch B) ✅
| Function | Current Grants | Used By | Risk |
|---|---|---|---|
| `fn_retention_cleanup()` | service_role | `lib/ops/retention.server.ts` (cron) | DONE |
| `fn_susut_bulanan_run(text)` | service_role | `lib/aset-susut.functions.ts`, hook cron | DONE |
| `migrasi_dataset_ke_forms(uuid)` | authenticated + service_role | `lib/forms-extras.functions.ts` (admin) | DONE |
| `fn_generate_nomor_surat(uuid,uuid)` | authenticated + service_role | `lib/nomor-surat.functions.ts` (admin OPD) | DONE |
| `rate_limit_increment(text,text,timestamptz)` | service_role | `lib/security/rate-limit.ts` (server-only) | DONE |

---

## Group A — Internal Authorization (auto check role di dalam fn)
Aman — sudah ada `IF NOT public.is_elevated_view(...) THEN RAISE EXCEPTION` di body. Cukup `REVOKE PUBLIC, anon; GRANT authenticated, service_role`.

| Function | Current | Used By | Route / Page | Recommended | Risk Saat Ini |
|---|---|---|---|---|---|
| `executive_summary()` | =X (PUBLIC) | `useExecutiveSummary` | `/admin/eksekutif` | authenticated | LOW (cek `is_elevated_view`) |
| `production_health_score()` | =X | admin health | `/admin/system-health` | authenticated | LOW |
| `governance_summary()` | =X | admin governance | `/admin/governance` | authenticated | LOW |
| `governance_inventory()` | =X | admin governance | `/admin/governance` | authenticated | LOW |
| `rating_list_admin()` | =X | superadmin only | `/admin/rating` | authenticated | LOW (cek `has_role super_admin`) |
| `riwayat_dengan_petugas(uuid)` | =X | detail permohonan | `/permohonan/$id` | authenticated | LOW (cek pemohon/admin) |
| `fn_approve_user(uuid,app_role,text)` | =X | admin verifikasi | `/admin/verifikasi` | authenticated | LOW (cek `has_role` 4 admin) |
| `fn_reject_user(uuid,text)` | =X | admin verifikasi | `/admin/verifikasi` | authenticated | LOW |

---

## Group B — Helper Read-Only (sering dipakai RLS policy)
Fungsi pendukung RLS. **JANGAN REVOKE dari `authenticated`** karena policy memanggilnya. Aman REVOKE dari PUBLIC (anon).

| Function | Current | Used By | Recommended | Risk Saat Ini |
|---|---|---|---|---|
| `has_role(uuid,app_role)` | =X | dipakai 80+ RLS policy + frontend | authenticated, service_role, **anon** (untuk RLS publik berita/layanan) | LOW |
| `has_permission(uuid,text)` | =X | RBAC frontend & policy | authenticated, service_role | LOW |
| `is_admin_pemda(uuid)` | =X | RLS policy | authenticated, service_role | LOW |
| `is_bupati(uuid)` | =X | RLS policy + `has_permission` | authenticated, service_role | LOW |
| `is_elevated_view(uuid)` | =X | fn internal | authenticated, service_role | LOW |
| `is_executive(uuid)` | =X | RLS | authenticated, service_role | LOW |
| `is_pimpinan(uuid)` | =X | RLS | authenticated, service_role | LOW |
| `get_user_opd(uuid)` | =X | RLS + frontend | authenticated, service_role | LOW |
| `get_user_desa(uuid)` | =X | RLS + frontend | authenticated, service_role | LOW |
| `get_effective_permissions(uuid)` | =X | frontend RBAC | authenticated, service_role | LOW |
| `is_pemohon_in_admin_opd(uuid,uuid)` | =X | RLS permohonan | authenticated, service_role | LOW |
| `is_pemohon_in_admin_desa(uuid,uuid)` | =X | RLS permohonan | authenticated, service_role | LOW |
| `check_signed_document_status(uuid)` | =X | verifikasi publik dokumen | **anon** + authenticated | MED (memang publik — perlu rate-limit) |
| `count_permohonan_bulan_ini()` | =X | dashboard admin | authenticated, service_role | LOW |
| `fn_permohonan_effective_sla_seconds(uuid)` | =X | detail permohonan | authenticated, service_role | LOW |
| `_lovable_request_uid()` | =X | utilitas internal | authenticated, service_role | LOW |

---

## Group C — Aggregate / Dashboard
Dipanggil dari admin/eksekutif/asn pages. Aman REVOKE anon; GRANT authenticated.

| Function | Used By | Page | Recommended | Risk |
|---|---|---|---|---|
| `aset_compliance(uuid)` | dashboard aset | `/admin/aset` | authenticated, service_role | LOW |
| `aset_due_warranty(int)` | dashboard aset | `/admin/aset/warranty` | authenticated, service_role | LOW |
| `attendance_compliance(uuid,date,date)` | dashboard absensi | `/asn/absensi` | authenticated, service_role | LOW |
| `attendance_device_alert(int)` | admin absensi | `/admin/absensi` | authenticated, service_role | LOW |
| `attendance_rekap_bulanan(uuid,int,int)` | rekap ASN | `/asn/rekap` | authenticated, service_role | LOW |
| `opd_attendance_today(uuid)` | dashboard OPD | `/admin/opd` | authenticated, service_role | LOW |
| `opd_kategori_benchmark(text)` | bench eksekutif | `/admin/eksekutif/benchmark` | authenticated, service_role | LOW |
| `opd_kinerja_agg()` | dashboard | `/admin/eksekutif` | authenticated, service_role | LOW |
| `opd_kinerja_trend(uuid,int)` | trend | `/admin/eksekutif` | authenticated, service_role | LOW |
| `opd_rating_agg()` | dashboard | `/admin/rating` | authenticated, service_role | LOW |
| `opd_skor_komposit()` | dashboard | `/admin/eksekutif` | authenticated, service_role | LOW |
| `layanan_kinerja_agg()` | dashboard | `/admin/layanan` | authenticated, service_role | LOW |
| `fn_ikm_dashboard(uuid)` | IKM dashboard | `/admin/ikm/$id` | authenticated, service_role | LOW |

---

## Group D — Trigger Functions (tidak dipanggil via API)
Hanya dijalankan oleh trigger. Aman `REVOKE EXECUTE FROM PUBLIC` (trigger jalan sebagai owner).

| Function | Triggered By |
|---|---|
| `aset_set_qr_token()` | `aset` BEFORE INSERT |
| `handle_new_user()` | `auth.users` AFTER INSERT |
| `log_permohonan_change()` | `permohonan` AFTER UPDATE |
| `prevent_unverified_role_insert()` | `user_roles` BEFORE INSERT |
| `prevent_self_role_change()` | `user_roles` BEFORE INSERT/UPDATE |
| `set_updated_at()` | many tables BEFORE UPDATE |
| `sync_compliance_aliases()` | `compliance_checklist` |
| `sync_dataset_submission_aliases()` | `dataset_submission` |
| `sync_dataset_review_aliases()` | `dataset_submission_review` |
| `sync_dataset_template_aliases()` | `dataset_template` |
| `sync_feature_flag_aliases()` | `feature_flags` |
| `sync_uat_aliases()` | `uat_scenarios` |
| `tg_signed_documents_validate_revoke()` | `signed_documents` |

Semua → `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT TO service_role` (untuk maintenance).

---

## Ringkasan Rekomendasi Batch E

| Kategori | Jumlah | Pola Perubahan |
|---|---|---|
| Group A (auth-internal) | 8 | `REVOKE PUBLIC,anon; GRANT authenticated,service_role` |
| Group B (helper) | 16 | `REVOKE PUBLIC,anon; GRANT authenticated,service_role` (kecuali `has_role` & `check_signed_document_status` yg butuh `anon`) |
| Group C (aggregate) | 13 | `REVOKE PUBLIC,anon; GRANT authenticated,service_role` |
| Group D (trigger) | 13 | `REVOKE PUBLIC,anon,authenticated; GRANT service_role` |

**Total:** 50 fungsi. Setelah Batch E, hampir semua WARN `0028_anon_security_definer_function_executable` (≈100) akan hilang.

## Risiko Batch E
- **None** untuk Group D (trigger).
- **LOW** untuk A/B/C — semua sudah memiliki internal authorization atau dipakai RLS yang otomatis menyaring.
- **PERHATIAN:** `has_role` HARUS tetap callable oleh `anon` karena dipakai RLS policy untuk SELECT publik (berita, layanan publik, kategori). Jangan REVOKE dari anon untuk fungsi ini.
- **PERHATIAN:** `check_signed_document_status` adalah endpoint verifikasi publik (QR scan dokumen). Pertahankan `anon` + tambahkan rate-limit di server fn.

## Next Steps
Setelah review matrix ini, kirim approval untuk:
1. **Batch E migration** (50 fungsi)
2. Atau pecah Batch E menjadi sub-batch: E1 (trigger), E2 (helper), E3 (aggregate), E4 (auth-internal) bila ingin deploy bertahap.
