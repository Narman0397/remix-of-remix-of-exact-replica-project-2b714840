# Phase 6 — Batch E Plan (E1 & E2 applied; E3 & E4 pending)

## E1 — Trigger Functions (READY TO APPLY)

### Verification
`rg` di seluruh `src/` tidak menemukan satu pun RPC/HTTP call ke 13 trigger function. Hanya komentar `// trigger ...` yang merujuk.

| Function | Direct callers |
|---|---|
| aset_set_qr_token | NONE (komentar saja) |
| handle_new_user | NONE (terhubung ke `auth.users` trigger) |
| log_permohonan_change | NONE |
| prevent_unverified_role_insert | NONE (komentar) |
| prevent_self_role_change | NONE |
| set_updated_at | NONE |
| sync_compliance_aliases / sync_dataset_* / sync_feature_flag_aliases / sync_uat_aliases | NONE |
| tg_signed_documents_validate_revoke | NONE |

**Konklusi:** aman REVOKE PUBLIC, anon, authenticated; tetap GRANT service_role.

### Migration & Rollback
Lihat:
- `supabase/migrations/...batch_e1.sql`
- `docs/audit/rollback/BATCH_E1_rollback.sql`

## E2 — Aggregate Functions (READY TO APPLY)

### Verification
Semua aggregate dipanggil via `supabaseAdmin.rpc` (service_role) — **kecuali**:
- `opd_kinerja_agg` & `opd_rating_agg` → dipanggil dari `src/lib/kinerja-queries.ts` dengan client `authenticated`.

Karena `authenticated` tetap dibutuhkan, pola E2 = `REVOKE PUBLIC, anon; GRANT authenticated, service_role` untuk semua.

| Function | Caller |
|---|---|
| aset_compliance | aset-advanced.functions.ts (admin) |
| aset_due_warranty | aset-mutasi.functions.ts + cron warranty-reminder |
| attendance_compliance | asn-advanced.functions.ts |
| attendance_device_alert | asn-izin.functions.ts (admin) |
| attendance_rekap_bulanan | asn-izin.functions.ts |
| opd_attendance_today | asn-advanced.functions.ts |
| opd_kategori_benchmark | kinerja.functions.ts |
| opd_kinerja_agg | kinerja-queries.ts (auth client) |
| opd_kinerja_trend | kinerja.functions.ts |
| opd_rating_agg | kinerja-queries.ts (auth client) |
| opd_skor_komposit | kinerja.functions.ts |
| layanan_kinerja_agg | kinerja.functions.ts |
| fn_ikm_dashboard | ikm.functions.ts |

Lihat:
- `supabase/migrations/...batch_e2.sql`
- `docs/audit/rollback/BATCH_E2_rollback.sql`

---

## E3 — Helper Functions (PENDING — DO NOT APPLY)

### Dependency Graph (high level)

```
has_role(_uid, _role)
├── direkur ratusan RLS policy (SELECT/INSERT/UPDATE/DELETE) di:
│   permohonan, profiles, user_roles, aset, opd, desa, kategori_layanan,
│   layanan_publik, berita, ikm_*, dokumen_*, signed_documents, dst.
├── dipanggil dari has_permission() (PL/pgSQL)
├── dipanggil dari is_admin_pemda(), is_elevated_view(), is_executive()
├── dipanggil dari rating_list_admin(), governance_*, fn_approve_user, fn_reject_user
├── dipanggil dari frontend:
│     src/lib/auth-context.tsx (cek role)
│     src/features/rbac/*
│     berbagai server fn (supabase.rpc('has_role', ...))
└── CRITICAL: dipakai oleh RLS policy untuk SELECT publik (berita, layanan_publik)
              → HARUS tetap callable oleh anon.

has_permission(_uid, _code)
├── frontend useEffectivePermissions (cek capability)
└── beberapa RLS policy (permissions-based)

get_user_opd(_uid)
├── RLS policy: permohonan, aset, dataset_template, dst.
├── frontend: server fn untuk scope OPD
└── fn lain: is_pemohon_in_admin_opd

get_user_desa(_uid)
├── RLS policy permohonan/profiles by desa
└── is_pemohon_in_admin_desa

get_effective_permissions(_uid)
└── frontend: permissions.functions.ts (RBAC)

is_elevated_view / is_admin_pemda / is_executive / is_pimpinan / is_bupati
└── RLS policy + body of governance_*/executive_summary/production_health_score
```

### Impact Report
| Function | If REVOKE anon | Risiko |
|---|---|---|
| `has_role` | **BREAKING** — RLS SELECT publik (berita/layanan) tertolak | HIGH — JANGAN REVOKE anon |
| `has_permission` | RLS yang mengandalkannya akan gagal saat anon | MED — keep anon (atau switch ke authenticated-only policy) |
| `get_user_opd` / `get_user_desa` | RLS policy fail saat anon (saat ini policy diharap return false untuk anon) | LOW — anon return NULL aman; bisa REVOKE anon |
| `get_effective_permissions` | hanya dipanggil server fn `authenticated` | aman REVOKE anon |
| `is_*` helpers | hanya dipanggil dari body fn lain & RLS | aman REVOKE anon kecuali RLS publik pakai (audit ulang) |
| `is_pemohon_in_admin_*` | RLS permohonan saja | aman REVOKE anon |
| `count_permohonan_bulan_ini` / `fn_permohonan_effective_sla_seconds` / `_lovable_request_uid` / `check_signed_document_status` | yang public (verify) → tetap anon | per kasus |

### Rekomendasi
- Tetap pertahankan `has_role` dan `check_signed_document_status` callable oleh `anon`.
- Sub-batch E3a: REVOKE anon dari helper yang **tidak** dipakai RLS publik.
- Sub-batch E3b: jangan sentuh `has_role` & `check_signed_document_status`.

**Status: AWAIT APPROVAL.**

---

## E4 — Internal Authorization Functions (PENDING — DO NOT APPLY)

### Functions
`executive_summary`, `governance_summary`, `governance_inventory`, `production_health_score`, `rating_list_admin`, `riwayat_dengan_petugas`, `fn_approve_user`, `fn_reject_user`.

### Dependency Graph
- Semua memiliki **internal authorization** (`IF NOT is_elevated_view(auth.uid()) THEN RAISE`).
- Dipanggil dari halaman admin (`/admin/eksekutif`, `/admin/governance`, `/admin/system-health`, `/admin/rating`, `/admin/verifikasi`, `/permohonan/$id`).
- Tidak ada caller anon.

### Risk Report
| Function | Saat ini grant | Risiko publik | Recommended |
|---|---|---|---|
| executive_summary | =X (PUBLIC) | LOW (cek `is_elevated_view`) | REVOKE PUBLIC, anon; GRANT authenticated, service_role |
| governance_summary | =X | LOW (cek `is_elevated_view`) | sama |
| governance_inventory | =X | LOW (cek `is_super/pemda`) | sama |
| production_health_score | =X | LOW (cek `is_elevated_view`) | sama |
| rating_list_admin | =X | LOW (cek super_admin) | sama |
| riwayat_dengan_petugas | =X | LOW (cek pemohon/admin) | sama |
| fn_approve_user | =X | LOW (cek role admin) | sama |
| fn_reject_user | =X | LOW (cek role admin) | sama |

### Migration & Rollback (DRAFT — tidak dieksekusi)
```sql
-- Batch E4 (DRAFT)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'executive_summary()',
    'governance_summary()',
    'governance_inventory()',
    'production_health_score()',
    'rating_list_admin()',
    'riwayat_dengan_petugas(uuid)',
    'fn_approve_user(uuid,app_role,text)',
    'fn_reject_user(uuid,text)'
  ]) AS sig
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
```
Rollback:
```sql
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT unnest(ARRAY[...]) AS sig LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO PUBLIC', r.sig);
  END LOOP;
END $$;
```

**Status: AWAIT APPROVAL.**
