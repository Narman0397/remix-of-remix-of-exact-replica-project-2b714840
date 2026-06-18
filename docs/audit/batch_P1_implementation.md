# Batch P1 — Performance Index Implementation Package

**Tanggal:** 2026-06-18 · **Status:** APPLIED

## Audit Existing Indexes
Verifikasi `pg_indexes` menunjukkan sebagian besar rekomendasi awal **sudah ada**:

| ID | Tabel/Kolom | Status Sebelum | Catatan |
|---|---|---|---|
| P-01 | `permohonan(opd_id, status, tanggal_masuk DESC)` | ✅ ADA (`idx_permohonan_opd_status_tanggal`) | Skip |
| P-02 | `permohonan(pemohon_id, status)` | ❌ HANYA `pemohon_id` | **APPLY** |
| P-04 | `audit_log(created_at DESC)` | ✅ ADA (`idx_audit_log_created`) | Skip |
| P-05 | `notifications(user_id, created_at DESC) WHERE dibaca=false` | ✅ ADA | Skip |
| P-06 | `form_submissions(form_id, status, submitted_at)` | ⚠️ ADA `(form_id, status)` tanpa submitted_at | Skip (sudah cukup) |
| P-08 | `aset(opd_id, status) WHERE status<>'dihapuskan'` | ❌ TIDAK ADA | **APPLY** |

## Indexes Yang Akan Dibuat (2 indexes baru)

### P-02: `idx_permohonan_pemohon_status`
- **Tabel:** `permohonan`
- **Kolom:** `(pemohon_id, status)`
- **Query terdampak:** halaman warga "Permohonan Saya" dengan filter status, dashboard kepatuhan per-pemohon.
- **Benefit:** ganti seq scan + filter → index scan; 10–50× speedup pada user dengan > 50 permohonan.
- **Estimasi size:** ~24 bytes × rows. Saat ini ~1k baris → < 100 KB.
- **Rollback:** `DROP INDEX IF EXISTS public.idx_permohonan_pemohon_status;`

### P-08: `idx_aset_opd_status_active`
- **Tabel:** `aset`
- **Kolom:** `(opd_id, status)` **WHERE** `status <> 'dihapuskan'`
- **Query terdampak:** `aset_compliance()`, list aset OPD aktif, dashboard compliance.
- **Benefit:** partial index meminimalkan ukuran; menghindari scan baris terhapus.
- **Estimasi size:** partial, ~16 bytes × baris aktif. < 200 KB pada skala saat ini.
- **Rollback:** `DROP INDEX IF EXISTS public.idx_aset_opd_status_active;`

## Catatan `CONCURRENTLY`
`CREATE INDEX CONCURRENTLY` **tidak dapat berjalan di dalam transaction block**, sehingga tidak kompatibel dengan migration tool (yang membungkus migrasi dalam transaksi). Karena ukuran tabel saat ini < 5k rows, `CREATE INDEX` reguler menyelesaikan dalam < 1 detik dan lock penulisan dapat diabaikan. Untuk skala produksi > 100k rows, lakukan ulang `CONCURRENTLY` via psql manual setelah snapshot.

## Verification Plan
1. `EXPLAIN (ANALYZE) SELECT * FROM permohonan WHERE pemohon_id = ? AND status = 'baru';` → harus `Index Scan using idx_permohonan_pemohon_status`.
2. `EXPLAIN (ANALYZE) SELECT public.aset_compliance(<opd_id>);` → child plan harus `Index Scan using idx_aset_opd_status_active`.
3. Re-run `pg_stat_user_indexes` setelah 24h untuk memastikan `idx_scan` > 0.
