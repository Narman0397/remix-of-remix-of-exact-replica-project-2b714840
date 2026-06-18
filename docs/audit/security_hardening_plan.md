# Security Hardening & Stabilization Plan

**Tanggal:** 2026-06-18  
**Status:** ANALYSIS ONLY — tidak ada perubahan yang diterapkan.  
**Sumber kebenaran:** `docs/audit/security_remediation_report.md` + verifikasi live database & codebase.

---

## 1. Executive Summary

| Kategori | Temuan | Severity | Rencana |
|---|---|---|---|
| SECURITY DEFINER View | 2 view | ERROR | Batch A — `security_invoker=true` |
| Function high-risk PUBLIC EXECUTE | 5 fungsi mutator | HIGH | Batch B — `REVOKE PUBLIC`, grant ke `service_role`/`authenticated` |
| Policy `USING/CHECK (true)` | 5 (3 intentional, 2 duplikat) | MEDIUM | Batch C — drop duplikat, tambah hardening (captcha/rate limit) di server fn |
| Mutable `search_path` | 2 trigger fn | LOW | Batch D — `ALTER FUNCTION ... SET search_path` |
| Function PUBLIC EXECUTE lain | 50 fungsi (helper/agregat/trigger) | LOW–MEDIUM | Batch E — sweep `REVOKE PUBLIC; GRANT authenticated/service_role` |

Semua perubahan **reversible** dengan rollback yang disediakan per batch. Tidak ada DROP yang menghilangkan business logic; perubahan terbatas pada **privilege & metadata**.

---

## 2. Phase 1 — Dependency Matrix

Hasil scan kode (`rg`) + introspeksi `pg_policies` + `pg_views`.

| Object | Type | Used By | Risk If Changed |
|---|---|---|---|
| `aset_nilai_buku` | VIEW | `src/lib/aset-susut.functions.ts`, `src/lib/aset-mutasi.functions.ts` (read via supabase-js, RLS user) | Setelah `security_invoker=true`, user butuh `SELECT` di tabel `aset` & `aset_penyusutan_history`. Policy existing pada `aset` sudah meng-cover admin/asn per-OPD; warga **tidak** punya akses (sesuai desain). **Risk: LOW** untuk admin/asn, perlu test untuk caller non-admin. |
| `v_permohonan_overdue` | VIEW | `executive_summary()`, `production_health_score()` (fungsi SECURITY DEFINER — tetap bypass RLS), tidak dipanggil langsung dari client | Karena hanya dibaca dari SECURITY DEFINER fn (yang sudah cek `is_elevated_view`), aman. **Risk: LOW**. |
| `fn_retention_cleanup()` | FUNCTION | `src/lib/ops/retention.server.ts` → cron `/api/public/hooks/retention-cleanup` | Endpoint sudah pakai `CRON_SECRET` + `supabaseAdmin`. Aman REVOKE PUBLIC. **Risk: LOW**. |
| `fn_susut_bulanan_run(text)` | FUNCTION | `src/lib/aset-susut.functions.ts` (admin trigger), cron `/api/public/hooks/aset-susut-bulanan` | Caller admin pakai user JWT — perlu `GRANT authenticated` agar tetap bisa via RLS-aware fn yang membungkusnya, atau pindah panggilan ke `supabaseAdmin`. **Risk: MEDIUM**. |
| `migrasi_dataset_ke_forms(uuid)` | FUNCTION | `src/lib/dataset.functions.ts` (admin only) | Caller server fn dengan `requireSupabaseAuth` + cek role. Aman GRANT ke `authenticated` (server fn sudah pre-authz). **Risk: LOW**. |
| `fn_generate_nomor_surat(uuid,uuid)` | FUNCTION | `src/lib/nomor-surat.functions.ts` (admin OPD via server fn) | Sama. Aman GRANT ke `authenticated`. **Risk: LOW**. |
| `rate_limit_increment(text,text,timestamptz)` | FUNCTION | `src/lib/security/rate-limit.ts` (server-only, `supabaseAdmin`) | Aman REVOKE PUBLIC; grant `service_role` saja. **Risk: LOW**. |
| `tg_pengajuan_izin_set_saldo_flag()` | TRIGGER FN | Trigger `pengajuan_izin` (INSERT) | `SET search_path` tidak memengaruhi caller. **Risk: NONE**. |
| `tg_bump_version_number()` | TRIGGER FN | Trigger `form_submission_versions`/`form_submissions` UPDATE | Sama. **Risk: NONE**. |
| Policy `laporan_masyarakat.lap_ins` | POLICY | Duplikat dari `Publik kirim laporan` | Drop tidak mengubah akses (policy permissive — OR). **Risk: NONE**. |
| Policy `ikm_responses_insert` | POLICY | Form IKM publik (`src/routes/ikm.$id.tsx`) | Wajib tetap ada. Tambah captcha/rate-limit di server fn pembungkus. |
| Policy `geofence_audit_super` | POLICY | Audit admin (`admin.system-health.tsx`) | Intentional — admin only. Tidak diubah. |
| Policy `rate_limit_hits_super` | POLICY | Admin metrics | Intentional. Tidak diubah. |

> Catatan: scan `pg_depend` untuk view/function tidak menemukan dependent objek lain (tabel/view/materialized view) yang me-`SELECT FROM` view ini, jadi `ALTER VIEW SET (security_invoker=true)` tidak akan memutus chain SQL apa pun.

---

## 3. Phase 2 — Batch A: SECURITY DEFINER View Fix

### Migration
```sql
-- Batch A: enable security_invoker (default false on PG≥15)
ALTER VIEW public.aset_nilai_buku      SET (security_invoker = true);
ALTER VIEW public.v_permohonan_overdue SET (security_invoker = true);
```

### Rollback
```sql
ALTER VIEW public.aset_nilai_buku      SET (security_invoker = false);
ALTER VIEW public.v_permohonan_overdue SET (security_invoker = false);
```

### Impact
- `aset_nilai_buku`: caller butuh `SELECT` ke `aset` & `aset_penyusutan_history`. Sudah ter-cover untuk `super_admin`, `admin_pemda`, `admin_opd` (same OPD), `pimpinan` (read), `asn` (same OPD). **Warga akan kehilangan akses** — sesuai desain (warga seharusnya tidak melihat nilai buku).
- `v_permohonan_overdue`: hanya dipanggil dari SECURITY DEFINER fn — tidak terdampak.

### Testing Checklist
- [ ] Admin OPD: buka `/admin/aset` → kolom Nilai Buku tampil.
- [ ] Super admin: dashboard eksekutif `production_health_score` jalan.
- [ ] ASN (same OPD): list aset menampilkan nilai_buku.
- [ ] Warga login (jika punya menu): tidak ada error 500; nilai_buku kosong / row tidak muncul.

---

## 4. Phase 3 — Batch B: High-Risk Function Hardening

### Groupings
- **A (auth internal — biar tetap, opsional perketat):** `executive_summary`, `production_health_score`, `governance_summary`, `governance_inventory`, `rating_list_admin`, `riwayat_dengan_petugas`, `fn_approve_user`, `fn_reject_user`.
- **B (helper read-only):** `has_role`, `has_permission`, `is_admin_pemda`, `is_bupati`, `is_elevated_view`, `is_executive`, `is_pimpinan`, `get_user_opd`, `get_user_desa`, `get_effective_permissions`, `is_pemohon_in_admin_opd`, `is_pemohon_in_admin_desa`, `check_signed_document_status`, `count_permohonan_bulan_ini`, `fn_permohonan_effective_sla_seconds`, `_lovable_request_uid`.
- **C (agregat dashboard):** `aset_compliance`, `aset_due_warranty`, `attendance_compliance`, `attendance_device_alert`, `attendance_rekap_bulanan`, `opd_attendance_today`, `opd_kategori_benchmark`, `opd_kinerja_agg`, `opd_kinerja_trend`, `opd_rating_agg`, `opd_skor_komposit`, `layanan_kinerja_agg`, `fn_ikm_dashboard`.
- **D (mutator privileged):** `fn_retention_cleanup`, `fn_susut_bulanan_run`, `migrasi_dataset_ke_forms`, `fn_generate_nomor_surat`, `rate_limit_increment`.
- **E (trigger fn — tidak via API):** `tg_*`, `sync_*`, `set_updated_at`, `log_permohonan_change`, `prevent_*`, `handle_new_user`, `aset_set_qr_token`.

### Migration (Group D — paling penting)
```sql
-- D1: retention cleanup — hanya cron (supabaseAdmin)
REVOKE EXECUTE ON FUNCTION public.fn_retention_cleanup()         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_retention_cleanup()         TO service_role;

-- D2: susut bulanan — cron + admin via server fn (server fn akan dipindah ke supabaseAdmin)
REVOKE EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text)     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text)     TO service_role;

-- D3: migrasi dataset — admin via server fn (pre-authz)
REVOKE EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid) TO authenticated, service_role;

-- D4: nomor surat — admin OPD via server fn
REVOKE EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid,uuid) TO authenticated, service_role;

-- D5: rate-limit increment — server-only
REVOKE EXECUTE ON FUNCTION public.rate_limit_increment(text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.rate_limit_increment(text,text,timestamptz) TO service_role;
```

### Rollback
```sql
GRANT EXECUTE ON FUNCTION public.fn_retention_cleanup()                  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text)              TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid)          TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid,uuid)      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text,text,timestamptz) TO PUBLIC;
```

### Code Adjustments (sebelum apply)
- `src/lib/aset-susut.functions.ts`: jika handler memanggil `fn_susut_bulanan_run` lewat user supabase client, ganti ke `supabaseAdmin` (sudah pre-authz lewat `requirePermissionOrThrow`).
- `src/lib/security/rate-limit.ts`: sudah pakai `supabaseAdmin` ✅.

### Testing Checklist
- [ ] Cron `retention-cleanup` jalan (cek `cron_history`).
- [ ] Admin trigger `fn_susut_bulanan_run` dari `/admin/aset/penyusutan` sukses.
- [ ] Admin Pemda klik “Migrasikan ke Forms” di `/admin/dataset` sukses.
- [ ] Admin OPD generate nomor surat dari `/admin/nomor-surat` sukses.
- [ ] Upload file → rate-limit counter bertambah (cek `rate_limit_hits`).

---

## 5. Phase 4 & 5 — Batch C: RLS Policy Cleanup

### Analysis
| Policy | Tabel | Status | Aksi |
|---|---|---|---|
| `Publik kirim laporan` | `laporan_masyarakat` | Intentional (warga lapor) | KEEP |
| `lap_ins` | `laporan_masyarakat` | Duplikat | **DROP** |
| `ikm_responses_insert` | `ikm_responses` | Intentional (form IKM publik) | KEEP + hardening |
| `geofence_audit_super` | `geofence_audit` | Intentional (admin only) | KEEP |
| `rate_limit_hits_super` | `rate_limit_hits` | Intentional (admin only) | KEEP |

### Migration
```sql
-- Batch C
DROP POLICY IF EXISTS "lap_ins" ON public.laporan_masyarakat;
```

### Rollback
```sql
CREATE POLICY "lap_ins" ON public.laporan_masyarakat FOR INSERT WITH CHECK (true);
```

### Hardening rekomendasi (kode, bukan SQL)
- Bungkus endpoint `POST /api/public/hooks/lapor` & form IKM dengan server fn yang:
  1. Validasi Turnstile/HCaptcha token.
  2. Panggil `enforceRateLimit(ip, { scope:'lapor', windowSec:600, max:5 })`.
  3. Isi `created_by_ip` & `user_agent_hash` di server (bukan dari client).
- Tidak perlu mengubah policy publik.

---

## 6. Phase 6 — Batch D: Search Path Hardening

### Migration
```sql
ALTER FUNCTION public.tg_pengajuan_izin_set_saldo_flag() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_bump_version_number()           SET search_path = public, pg_temp;
```

### Rollback
```sql
ALTER FUNCTION public.tg_pengajuan_izin_set_saldo_flag() RESET search_path;
ALTER FUNCTION public.tg_bump_version_number()           RESET search_path;
```

### Impact: tidak ada — trigger tetap jalan, hanya menutup hijack path.

---

## 7. Phase 7 — Storage Security Audit

| Bucket | Public | Policies (SELECT / INSERT / UPDATE / DELETE) | MIME/size enforced? | Catatan |
|---|---|---|---|---|
| `branding` | private (workspace mem-block public) | auth read, admin write | tidak (perlu di-server) | Diakses lewat signed URL — OK. |
| `pejabat-foto` | private | sama | tidak | Sama. |
| `berkas-permohonan` | private | owner/admin per-folder | tidak | Folder convention `userId/...` aman. |
| `aset-foto` | private | auth read/insert, owner/admin delete | tidak | OK. |
| `absensi-foto` | private | own folder insert, owner/admin read/delete | tidak | OK. |
| `form-uploads` | private | sda | tidak | OK. |
| `share-files` | private | auth read, admin write | tidak | OK. |
| `signatures` | private | owner-only | tidak | OK. |
| `documents` | private | owner-only | tidak | OK. |
| `signed-documents` | private | (lihat policy) | tidak | Sudah pakai signed URL untuk publik. |
| `verification-assets` | private | dedicated R/W/D/U | tidak | OK. |

### Rekomendasi Hardening (tidak di-apply)
1. Enable MIME whitelist & max size per bucket via `storage.buckets.allowed_mime_types` + `file_size_limit` (perlu service role).  
2. Setelah workspace policy mengizinkan public bucket, set `branding` & `pejabat-foto` ke public **read-only** untuk performa (saat ini OK via signed URL).  
3. Tambah trigger `storage.objects` untuk reject path traversal (`..`).

---

## 8. Phase 8 — Cron Security Review

Akses `cron.job` ditolak untuk role saat ini (membutuhkan superuser/`postgres`). Berdasarkan kode di `src/routes/api/public/hooks/*`:

| Hook | Schedule (rencana) | Auth | Service-role? | Eksternal abuse? |
|---|---|---|---|---|
| `retention-cleanup` | daily 02:00 | header `CRON_SECRET` | ya (`supabaseAdmin`) | aman |
| `aset-susut-bulanan` | monthly 01-th | `CRON_SECRET` | ya | aman |
| `aset-warranty-reminder` | daily | `CRON_SECRET` | ya | aman |
| `assignment-reminder` | hourly | `CRON_SECRET` | ya | aman |
| `backup-snapshot` | daily | `CRON_SECRET` | ya | aman |
| `cleanup-uploads` | hourly | `CRON_SECRET` | ya | aman |
| `cron-watchdog` | every 15m | `CRON_SECRET` | ya | aman |
| `form-deadline-reminder` | hourly | `CRON_SECRET` | ya | aman |
| `retry-queue` | every 5m | `CRON_SECRET` | ya | aman |
| `sla-escalation` | every 30m | `CRON_SECRET` | ya | aman |
| `sla-reminder` | hourly | `CRON_SECRET` | ya | aman |
| `storage-cleanup` | daily | `CRON_SECRET` | ya | aman |
| `stuck-jobs` | hourly | `CRON_SECRET` | ya | aman |
| `upload-integrity` | hourly | `CRON_SECRET` | ya | aman |

> Semua hook memvalidasi `Authorization: Bearer <CRON_SECRET>` sebelum melakukan apa pun. Catatan: walaupun route ada di `/api/public/*` (bypass auth), check eksplisit ini mencegah abuse.

---

## 9. Phase 9 — Auth & Privilege Matrix

| Role | Cross-OPD read | Cross-OPD write | Cross-desa read | Privileged fn (D) | Notes |
|---|---|---|---|---|---|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | bypass RLS via `has_role` |
| `admin_pemda` | ✅ (view-only) | ❌ | ✅ (view) | ❌ | dibatasi permission `view_%`/`pemda.%` |
| `pimpinan` | ✅ (view) | bupati: approve/sign/disposition saja | ✅ | ❌ | `is_bupati` cek tipe pejabat |
| `admin_opd` | ❌ (scoped OPD) | ❌ (scoped OPD) | ❌ | ❌ | `get_user_opd()` filter |
| `admin_desa` | ❌ | ❌ | ❌ (scoped desa) | ❌ | scoped desa |
| `asn` | ❌ | ❌ (own data) | ❌ | ❌ | own assignment only |
| `warga` | ❌ | ❌ (own permohonan) | ❌ | ❌ | RLS `pemohon_id = auth.uid()` |
| `anon` | publik read (berita, layanan, kategori, opd, pejabat) | INSERT IKM & lapor | — | ❌ | terkunci untuk semua mutator |

Tidak ditemukan privilege escalation path setelah Batch A–E diterapkan, karena:
- `prevent_unverified_role_insert` mencegah role grant ke akun belum verified.
- `prevent_self_role_change` mencegah self-promote.
- Setelah Batch B, mutator fn tidak bisa dipanggil `anon` lagi.

---

## 10. Phase 10 — Migration Plan (5 Batches)

### Order of Deployment
1. **Batch D** (search_path) — risiko nol, deploy dulu untuk verifikasi pipeline migrasi.
2. **Batch C** (drop duplicate policy) — risiko nol.
3. **Batch A** (security_invoker views) — testing manual diperlukan untuk view caller.
4. **Batch B** (function privileges) — perlu code change di `aset-susut.functions.ts` lebih dulu.
5. **Batch E** (sweep grup B/C/E) — generator SQL:
   ```sql
   SELECT format(
     'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;',
     p.oid::regprocedure, p.oid::regprocedure)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prosecdef=true
     AND p.proname NOT IN ('fn_retention_cleanup','fn_susut_bulanan_run','rate_limit_increment');
   ```
   Output di-review per fungsi sebelum apply.

### Per-Batch Summary
| Batch | Files | Risk | Rollback |
|---|---|---|---|
| A | views | LOW (warga test) | `SET (security_invoker=false)` |
| B | 5 fn | MEDIUM (perlu code tweak) | `GRANT TO PUBLIC` |
| C | 1 policy | NONE | recreate policy |
| D | 2 fn | NONE | `RESET search_path` |
| E | ~50 fn | LOW | `GRANT TO PUBLIC` |

---

## 11. Regression Testing Checklist (post-deploy)

- [ ] Login warga + buat permohonan → tetap berhasil.
- [ ] Admin OPD verifikasi permohonan.
- [ ] Dashboard eksekutif (`/admin/eksekutif`) load tanpa error.
- [ ] Dashboard pemda (`/pemda`) load.
- [ ] ASN absensi (foto upload) — bucket OK.
- [ ] Admin generate nomor surat.
- [ ] Admin trigger penyusutan bulanan.
- [ ] Cron `retention-cleanup` sukses (log di `cron_history`).
- [ ] Form publik IKM submit sukses + rate-limit.
- [ ] Laporan warga submit sukses + rate-limit.
- [ ] `supabase--linter` re-run → 0 ERROR, jumlah WARN turun signifikan.

---

## 12. Production Deployment Order

```
T+0   Batch D (search_path)
T+10m Verifikasi linter: 0 ERROR baru
T+15m Batch C (drop dup policy)
T+30m Batch A (views) + smoke test admin/asn/warga
T+1h  Code patch (supabaseAdmin di aset-susut) → deploy
T+1.5h Batch B (function grants D) + cron smoke
T+24h Batch E (sweep) + linter re-run
```

> **Tidak ada migrasi yang dijalankan otomatis.** Setelah persetujuan, saya akan mengirim per-batch sebagai migration terpisah (1 file per batch) dengan rollback file pasangan di `supabase/migrations/rollback/`.
