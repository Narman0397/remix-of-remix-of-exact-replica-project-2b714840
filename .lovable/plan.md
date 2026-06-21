# Gap Analysis — Form Builder

Berdasarkan audit `src/features/forms/*`, `src/lib/forms.functions.ts`, schema, builder, designer, renderer, services, dan wizard — modul Form Builder sudah cukup matang (CRUD draft, publish + snapshot, versioning, template, audit, validation, wizard, prefill, targets, conditional `visible_if`, 18 tipe field). Namun masih ada beberapa kekurangan yang relevan agar setara dengan modul Workflow/Document Runtime yang sudah selesai.

## Kekurangan yang teridentifikasi

### A. Schema & Tipe Field
1. Belum ada tipe **`time`**, **`datetime`**, **`rating`/`scale`**, **`address`**, **`nip`/`nik`** (validator khas ASN/PNS), padahal domain aplikasi pemerintahan.
2. **`repeater` / `group` (sub-form)** belum didukung — banyak proses kepegawaian butuh baris dinamis (riwayat jabatan, anggota keluarga, dsb).
3. **Computed/formula field** (mis. `gaji_pokok + tunjangan`) belum ada.
4. Validation belum mendukung **`unique` per submission**, **cross-field rule** (mis. `tanggal_akhir > tanggal_mulai`), dan **regex bernama** (NIP 18 digit, NIK 16 digit, NPWP).

### B. Builder UX
5. **Drag-and-drop reorder** field di `FormFieldsTab` (saat ini tampaknya hanya tombol urut).
6. **Duplicate field** dan **bulk action** (hapus banyak).
7. **Section/Page break** sudah ada sebagai tipe, tapi belum jadi **multi-step form** runtime di renderer (wizard sudah ada tapi terpisah).
8. **Import/Export schema JSON** untuk pertukaran antar instansi.
9. **Diff viewer antar versi** form (versioning sudah disimpan, belum ada UI bandingkan).

### C. Runtime & Integrasi
10. **Autosave draft submission** sisi warga/ASN saat mengisi form panjang.
11. **Field-level permission** (siapa boleh lihat / isi field tertentu — mis. hanya BKPSDM yang bisa isi "catatan internal").
12. **Encrypted field** untuk data sensitif (NIK, gaji) — at-rest encryption marker di schema.
13. **Attachment scanning** (size sudah ada, belum ada MIME sniff & virus-scan hook).
14. **Form analytics**: completion rate, drop-off per field, rata-rata waktu pengisian — belum ada (Dashboard Phase 4 hanya count submission).

### D. Lifecycle & Governance
15. **Scheduled publish/unpublish** (mis. form buka 1–15 setiap bulan) — `deadline` ada, tapi belum ada `open_at`.
16. **Form approval gate** sebelum publish (4 mata) — saat ini siapa pun admin OPD bisa langsung publish.
17. **Locale/i18n label** field (ID/EN) — belum disiapkan.
18. **A11y audit** renderer (label-for, aria-describedby help_text, aria-invalid) — perlu sweep.

### E. Integrasi lintas modul
19. **Mapping snapshot → Document placeholder catalog** otomatis: field form belum auto-muncul di placeholder picker dokumen (saat ini perlu manual mengetik `{{submission.kode}}`).
20. **Workflow form binding**: belum ada UI yang menunjukkan form mana yang dipakai workflow tertentu beserta validasi kompatibilitas snapshot saat workflow versi baru dibuat.

## Rekomendasi prioritas (jika ingin dilanjutkan ke Phase 1C)

**Must-have (P0)** — 1, 4, 5, 6, 10, 19
**Should-have (P1)** — 2, 9, 11, 14, 15, 20
**Nice-to-have (P2)** — 3, 7 (multi-step), 8, 12, 13, 16, 17, 18

## Catatan

Plan ini bersifat **analisis**, bukan implementasi. Setelah Anda memilih item prioritas (atau menyetujui scope P0), saya akan menyusun plan implementasi spesifik per item dengan: perubahan schema, migrasi DB, file UI baru, server functions, dan dampak ke modul Workflow/Document Runtime.

## Pertanyaan

- Apakah saya lanjutkan menyusun plan implementasi **Phase 1C** untuk seluruh P0, atau Anda ingin memilih subset tertentu?
