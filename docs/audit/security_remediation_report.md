# Security Remediation Report

**Tanggal:** 2026-06-18
**Total temuan linter Supabase:** 119 (2 ERROR, 117 WARN)
**Status:** Analisis saja — tidak ada perubahan dilakukan otomatis.

---

## Ringkasan per Kategori

| # | Kategori | Level | Jumlah | Lint code |
|---|---|---|---|---|
| 1 | Security Definer View | ERROR | 2 | `0010_security_definer_view` |
| 2 | Function Search Path Mutable | WARN | 2 | `0011_function_search_path_mutable` |
| 3 | RLS Policy Always True | WARN | 5 | `0024_permissive_rls_policy` |
| 4 | Public Can Execute SECURITY DEFINER Function | WARN | 55 | `0028_anon_security_definer_function_executable` |
| 5 | Signed-In Users Can Execute SECURITY DEFINER Function | WARN | 55 | `0029_authenticated_security_definer_function_executable` |

> Catatan: kategori #4 dan #5 selalu muncul berpasangan untuk fungsi yang sama (privilege `EXECUTE TO PUBLIC` otomatis mencakup `anon` + `authenticated`). Jadi 55 + 55 = 1 set fungsi.

---

## 1. Security Definer View — **ERROR** (2)

### Risiko
**TINGGI.** View dengan properti `SECURITY DEFINER` (atau default `security_invoker=false`) dieksekusi dengan hak pembuatnya (biasanya `postgres` superuser), **mem-bypass RLS** pada tabel dasar. Akibatnya: siapa pun yang punya `SELECT` ke view dapat membaca seluruh baris tabel, walaupun RLS-nya ketat.

### Objek terdampak
| View | Tabel sumber | Dampak |
|---|---|---|
| `public.aset_nilai_buku` | `public.aset`, `public.aset_penyusutan_history` | Bocor seluruh aset (termasuk milik OPD lain). |
| `public.v_permohonan_overdue` | `public.permohonan` | Bocor data permohonan warga lintas-OPD. |

### Mengapa muncul
Kedua view dibuat tanpa opsi `WITH (security_invoker = true)`. Pada PostgreSQL ≥15 (yang dipakai Supabase) ini default ke perilaku `SECURITY DEFINER`.

### Rekomendasi perbaikan
```sql
ALTER VIEW public.aset_nilai_buku      SET (security_invoker = true);
ALTER VIEW public.v_permohonan_overdue SET (security_invoker = true);
```
Setelah perubahan, verifikasi tiap fungsi/route yang membaca view tetap punya akses (mungkin perlu policy `SELECT` baru di tabel dasar untuk role tertentu).

---

## 2. Function Search Path Mutable — **WARN** (2)

### Risiko
**SEDANG.** Fungsi tanpa `SET search_path` rentan terhadap **search-path hijacking**: jika attacker dapat membuat objek di skema yang lebih dulu dalam path (mis. `pg_temp`), fungsi bisa memanggil objek palsu. Risiko bertambah parah jika fungsinya `SECURITY DEFINER`.

### Objek terdampak
| Function | SECURITY DEFINER? |
|---|---|
| `public.tg_pengajuan_izin_set_saldo_flag()` | tidak (`SECURITY INVOKER`) |
| `public.tg_bump_version_number()` | tidak |

Risiko praktis rendah karena keduanya `SECURITY INVOKER` dan dipakai sebagai trigger internal, tetapi linter tetap menandai.

### Rekomendasi perbaikan
```sql
ALTER FUNCTION public.tg_pengajuan_izin_set_saldo_flag() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_bump_version_number()           SET search_path = public, pg_temp;
```

---

## 3. RLS Policy Always True — **WARN** (5)

### Risiko
**TINGGI – SEDANG (case-by-case).** Policy `USING (true)` / `WITH CHECK (true)` pada `INSERT/UPDATE/DELETE` artinya **tidak ada filter** — siapa pun yang lewat role check (atau anon, jika role anon punya GRANT) dapat menulis bebas.

### Objek terdampak
| # | Tabel | Policy | Cmd | qual | with_check | Intentional? |
|---|---|---|---|---|---|---|
| 1 | `public.rate_limit_hits` | `rate_limit_hits_super` | ALL | `has_role(super_admin)` | `true` | **Ya** (super admin saja) — risiko rendah. |
| 2 | `public.ikm_responses` | `ikm_responses_insert` | INSERT | — | `true` | **Ya** (form publik IKM) — pastikan rate-limit + captcha. |
| 3 | `public.geofence_audit` | `geofence_audit_super` | ALL | `super_admin OR admin_opd` | `true` | **Ya** — risiko rendah. |
| 4 | `public.laporan_masyarakat` | `Publik kirim laporan` | INSERT | — | `true` | **Ya** (lapor warga anonim) — perlu rate-limit. |
| 5 | `public.laporan_masyarakat` | `lap_ins` | INSERT | — | `true` | **Duplikat** dari (4) → hapus salah satu. |

### Mengapa muncul
Sebagian sengaja untuk endpoint publik (form IKM, lapor warga). Sebagian admin-only sebenarnya aman tapi linter tidak bisa membedakan.

### Rekomendasi perbaikan
1. **Hapus duplikat:** `DROP POLICY "lap_ins" ON public.laporan_masyarakat;` (sisakan `Publik kirim laporan`).
2. **Tambah hardening untuk endpoint publik:**
   - Tambahkan kolom `created_by_ip` + `user_agent_hash` (server-side fill via trigger/RPC).
   - Wajibkan token captcha (HCaptcha/Turnstile) pada server function pemanggil; jangan ekspos langsung ke PostgREST.
   - Tegakkan rate-limit (sudah ada `rate_limit_hits` + `rate_limit_increment()`).
3. **Untuk policy admin-only** (`rate_limit_hits_super`, `geofence_audit_super`): pertahankan, tetapi sebaiknya pisahkan jadi policy per-command (`FOR INSERT/UPDATE/DELETE` dengan kondisi eksplisit) untuk menenangkan linter.

---

## 4 & 5. SECURITY DEFINER Functions yang Bisa Dipanggil PUBLIC / authenticated — **WARN** (110 = 55 fungsi × 2)

### Risiko
**SEDANG – TINGGI tergantung fungsi.** Fungsi `SECURITY DEFINER` berjalan dengan hak pemilik (superuser) dan **mem-bypass RLS**. Bila `EXECUTE` diberikan ke `PUBLIC` (otomatis mencakup `anon` + `authenticated`), siapa pun yang memanggil API dapat mengeksekusinya — sangat berbahaya kalau fungsi melakukan UPDATE/DELETE atau membaca data sensitif tanpa cek role internal.

### Objek terdampak (55 fungsi)
Dikelompokkan menurut tingkat risiko aktual:

#### A. Sudah memiliki authorization internal — **LOW RISK** (boleh tetap PUBLIC, opsional perketat)
Fungsi-fungsi ini secara internal memanggil `has_role()` / `is_elevated_view()` sebelum mengembalikan data:
- `executive_summary`, `production_health_score`, `governance_summary`, `governance_inventory`
- `rating_list_admin`, `riwayat_dengan_petugas`
- `fn_approve_user`, `fn_reject_user`

> Tetap aman, tetapi sebaiknya ubah GRANT menjadi `TO authenticated` saja (bukan PUBLIC) agar linter tenang.

#### B. Helper read-only ringan — **LOW RISK**
Fungsi pembantu yang hanya mengembalikan boolean/kecil tanpa data sensitif:
- `has_role`, `has_permission`, `is_admin_pemda`, `is_bupati`, `is_elevated_view`, `is_executive`, `is_pimpinan`
- `get_user_opd`, `get_user_desa`, `get_effective_permissions`
- `is_pemohon_in_admin_opd`, `is_pemohon_in_admin_desa`
- `check_signed_document_status`, `count_permohonan_bulan_ini`, `fn_permohonan_effective_sla_seconds`
- `_lovable_request_uid`

> Aman dipakai oleh policy lain. Rekomendasi: `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`

#### C. Agregat dashboard / kinerja — **MEDIUM RISK**
Mengembalikan agregat yang seharusnya tidak terbuka ke anon:
- `aset_compliance`, `aset_due_warranty`, `attendance_compliance`, `attendance_device_alert`, `attendance_rekap_bulanan`
- `opd_attendance_today`, `opd_kategori_benchmark`, `opd_kinerja_agg`, `opd_kinerja_trend`, `opd_rating_agg`, `opd_skor_komposit`
- `layanan_kinerja_agg`, `fn_ikm_dashboard`

> Rekomendasi: `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated;` dan tambahkan cek role di dalam fungsi (mis. `IF NOT is_elevated_view(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;`) untuk yang menampilkan lintas-OPD.

#### D. Mutator / privileged operation — **HIGH RISK** jika tetap PUBLIC
- `fn_generate_nomor_surat` — generate nomor surat resmi (idealnya admin OPD saja).
- `fn_retention_cleanup` — DELETE massal (HANYA cron/admin).
- `fn_susut_bulanan_run` — generate jurnal penyusutan (HANYA admin/cron).
- `migrasi_dataset_ke_forms` — bikin form baru (admin saja).
- `rate_limit_increment` — bisa dipakai untuk meracuni counter (rate-limit bypass).

> **Wajib:** `REVOKE EXECUTE FROM PUBLIC, authenticated; GRANT EXECUTE TO service_role;` dan panggil hanya dari server function dengan `requireSupabaseAuth` + role check, atau dari cron route dengan `CRON_SECRET`.

#### E. Trigger function (tidak benar-benar dipanggil via API) — **LOW RISK**
Fungsi-fungsi `tg_*`, `sync_*`, `set_updated_at`, `log_permohonan_change`, `prevent_*`, `handle_new_user`, `aset_set_qr_token`, `tg_signed_documents_validate_revoke` — hanya dipanggil oleh trigger. Aman untuk:
`REVOKE EXECUTE ON FUNCTION public.<nama>(...) FROM PUBLIC;` (trigger tetap berfungsi karena dijalankan sistem).

### Mengapa muncul
PostgreSQL secara default memberikan `EXECUTE` pada function baru ke `PUBLIC`. Skrip migrasi tidak menambahkan `REVOKE` setelah `CREATE FUNCTION`.

### Template perbaikan global (jangan dijalankan otomatis)
```sql
-- Pola untuk satu fungsi:
REVOKE EXECUTE ON FUNCTION public.<nama>(<arg_types>) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.<nama>(<arg_types>) TO authenticated;  -- atau service_role saja
```
Untuk eksekusi massal, gunakan generator:
```sql
SELECT format('REVOKE EXECUTE ON FUNCTION %s(%s) FROM PUBLIC, anon;',
              p.oid::regprocedure, pg_get_function_identity_arguments(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef=true;
```
Lalu jalankan output-nya per kelompok risiko di atas.

---

## Rekomendasi Eksekusi (urutan)

1. **Sekarang juga (ERROR):** ALTER 2 view → `security_invoker=true`.
2. **Hardening cepat:** REVOKE EXECUTE PUBLIC untuk 5 fungsi grup D (mutator/privileged).
3. **Hapus policy duplikat** `laporan_masyarakat.lap_ins`.
4. **Sweep grup B, C, E:** REVOKE PUBLIC → GRANT authenticated (atau service_role untuk trigger-only).
5. **Set `search_path`** pada 2 trigger function grup #2.
6. **Setelah selesai:** jalankan ulang `supabase--linter` untuk verifikasi 0 ERROR.

> Setelah Anda menyetujui, saya akan kirim migration terpisah untuk setiap langkah agar bisa di-review per kelompok.

---

## Yang tidak akan diubah
- Policy `USING(true)` pada `ikm_responses` & `laporan_masyarakat` (intentional public submission) — hanya ditambah hardening, tidak dihapus.
- Fungsi grup A (`executive_summary` dll.) tetap PUBLIC karena sudah punya cek role internal, kecuali Anda minta diperketat.
