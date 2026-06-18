
# Full Bring-Up Plan — Replikasi `narmantest11`

Tujuan: dari kondisi "file sudah di-mirror tapi backend kosong" menjadi aplikasi yang bisa dibuka, login, dan dipakai end-to-end di Lovable Cloud baru.

## Fase 1 — Aktifkan Lovable Cloud (prasyarat)
1. Enable Lovable Cloud → otomatis menyediakan `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`.
2. Update `.env` lokal: hapus kredensial proyek lama (`mzaugcjfdtlmwfmtvgzk`) supaya tidak ada split-brain antara dev & prod.
3. Pastikan extension Postgres aktif: `pgcrypto`, `pg_net`, `pg_cron`.

## Fase 2 — Skema Database (30 migrasi)
1. Jalankan seluruh file di `supabase/migrations/` sesuai urutan timestamp.
2. Verifikasi objek kritikal hadir:
   - Enum `app_role` + tabel `user_roles`, `permissions`, `user_permissions`, `rbac_audit`.
   - Function `has_role`, `has_permission`, `get_effective_permissions` (security definer).
   - Tabel domain: `profiles`, `opd`, `desa`, `pejabat`, `forms`, `assignments`, `submissions`, `permohonan`, `aset_*`, `asn_*`, `dokumen_*`, `ikm_*`, `share_paket`, `notifications`, `audit_log`, dll.
   - Trigger `handle_new_user` untuk auto-create profile.
3. Jika ada migrasi yang gagal (drift dari proyek sumber), perbaiki di tempat sebelum lanjut — jangan skip.

## Fase 3 — Storage Buckets + RLS
Buat 7 bucket sesuai audit:

| Bucket | Public | MIME | Size |
|---|---|---|---|
| `branding` | ✅ | image/* | 2 MB |
| `pejabat-foto` | ✅ | image/* | 1 MB |
| `berkas-permohonan` | ❌ | pdf/image/doc | 10 MB |
| `aset-foto` | ❌ | image/* | 5 MB |
| `absensi-foto` | ❌ | image/* | 2 MB |
| `form-uploads` | ❌ | pdf/image/doc | 20 MB |
| `share-files` | ❌ | * | 50 MB |

Tambah 1 migrasi `storage_policies.sql`: per bucket pasang policy `SELECT` (owner/admin OPD/role), `INSERT` (path harus diawali `auth.uid()`), `DELETE` (owner/admin).

## Fase 4 — Secrets & Konfigurasi Runtime
Tambahkan via `add_secret`:
- `CRON_SECRET` — dipakai oleh `src/lib/cron-auth.server.ts` untuk gate 15 endpoint `/api/public/hooks/*`.
- `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` — web push (NotificationBell, PushAutoEnable).
- (opsional) `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — hybrid storage provider Cloudflare R2.
- (opsional) `RESEND_API_KEY` jika modul email transaksional dipakai.

Auth providers:
- Default email/password sudah on.
- Google OAuth: tanya user apakah perlu; jika ya, konfigurasi via tool sosial auth.
- Scaffold custom auth email template hanya jika user minta branding email.

## Fase 5 — Seed Master Data + Super Admin
1. User pertama: minta user sign up via UI `/auth`, lalu jalankan SQL:
   ```sql
   INSERT INTO user_roles(user_id, role) VALUES ('<uuid>', 'super_admin');
   ```
2. Seed minimal (migrasi `seed_master.sql`):
   - 1 baris OPD default + assign super admin ke OPD itu.
   - Catalog `permissions` (jika belum diisi migrasi sumber).
   - Default branding (`app_setting`: nama instansi, logo placeholder).
3. Cron schedules — buat migrasi `pg_cron_schedules.sql` yang `cron.schedule(...)` ke 15 hooks dengan header `Authorization: Bearer <CRON_SECRET>` ke stable URL `project--<id>.lovable.app/api/public/hooks/<name>`.

## Fase 6 — Smoke Test End-to-End
Verifikasi tanpa berasumsi:
1. Build harus hijau (auto-build Lovable).
2. Halaman publik 200: `/`, `/layanan`, `/berita`, `/data-terbuka`, `/kinerja-opd`, `/tentang`, `/kontak`, `/ikm/<id>`, `/instansi/<singkatan>`.
3. Auth flow: sign-up → trigger profile → sign-in → redirect `_authenticated/route.tsx` → `/admin` super admin terbuka.
4. RBAC: `/admin/rbac` menampilkan user, dapat grant role.
5. Upload: 1 test upload per bucket (branding logo, berkas permohonan, aset foto).
6. Server function: panggil 1 `requireSupabaseAuth` fn (mis. `rbacListUsers`) — pastikan bearer terkirim.
7. Cron hook: curl 1 endpoint dengan `CRON_SECRET` — pastikan 200.
8. Pemeriksaan security: `security--run_security_scan` sebelum publish.

## Daftar Sentuhan Kode (minim — hanya yang perlu)
- `.env` — bersihkan kredensial lama.
- `supabase/migrations/<new>_storage_policies.sql` — policy 7 bucket.
- `supabase/migrations/<new>_seed_master.sql` — OPD default + permissions catalog jika kosong.
- `supabase/migrations/<new>_pg_cron_schedules.sql` — 15 jadwal cron.
- Tidak ada perubahan pada source code aplikasi kecuali ditemukan bug saat smoke test.

## Yang Tetap Manual oleh User
- Mengisi nilai secrets di dialog `add_secret`.
- Sign-up user pertama supaya bisa di-promote ke super admin.
- Mengganti aset visual final (lambang, hero) jika versi di zip placeholder.
- Connect custom domain (opsional, pasca-publish).

## Yang Sengaja Tidak Termasuk
- Re-implementasi modul yang membutuhkan Edge Function eksternal tidak ada di zip — akan dicatat di laporan akhir, bukan dibuat ulang dari nol kecuali user minta.
- Migrasi data riil dari proyek sumber (hanya skema + seed minimal).
