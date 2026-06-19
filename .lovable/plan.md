
# Phase 3B — Digital Signature (TTE) Runtime & QR Verification

Goal: tanda-tangani dokumen final hasil workflow melalui provider TTE (BSrE / e-Sign / Mock), kelola antrian + status, monitoring, QR public verification, webhook, retry, hash integrity, dan audit immutable. Tanpa KPI/BI dashboard.

## 1. Audit schema existing

Yang sudah ada dan dipakai-ulang:
- `documents`, `signed_documents` (id, document_id, document_hash, verification_token, status, signed_file_path, expires_at, revoked_*)
- `signing_certificates`, `digital_signatures` (spesimen)
- `document_audit` (untuk hash mismatch / verify event)
- `generated_documents` (status, snapshot, signed_document_id, archived_at)
- `workflow_audit_logs` (audit immutable)

Belum ada → migration baru:
- `signature_providers` (kode, nama, kind, status, config jsonb, webhook_secret)
- `signature_requests` (id, generated_document_id, provider_id, mode `sequential|parallel`, status, external_request_id, file_hash, current_step, created_by, sent_at, completed_at, cancelled_at, error)
- `signature_request_signers` (request_id, order_index, signer_type `user|role|position`, user_id, role, position, opd_id, status, external_signer_id, signed_at, rejected_at, reject_reason)
- `signature_events` (request_id, signer_id?, event `requested|sent|viewed|signed|rejected|expired|cancelled|downloaded|webhook_received|retry|failed`, payload jsonb, actor, created_at) — INSERT only via trigger guard.

RLS: SELECT untuk pemilik submission / OPD admin / super_admin; INSERT/UPDATE hanya via server functions (service_role). Public verification page tidak query langsung — pakai server function read-only.

## 2. Provider abstraction

`src/features/signature/providers/types.ts`
```
interface SignatureProvider {
  code: 'mock' | 'bsre' | 'esign';
  sendDocument(input): Promise<{ externalRequestId; status }>;
  checkStatus(externalRequestId): Promise<ProviderStatus>;
  downloadSignedDocument(externalRequestId): Promise<{ bytes; mime }>;
  cancelRequest(externalRequestId, reason): Promise<void>;
  verifyWebhook(headers, rawBody, secret): WebhookEvent | null;
}
```
Implementasi:
- `MockProvider` (langsung mark signed setelah delay simulasi, untuk dev/test).
- `BSrEProvider` (skeleton: REST call ke endpoint BSrE, header `Authorization` dari secret `BSRE_API_KEY`/`BSRE_BASE_URL`).
- `ESignProvider` (skeleton serupa).
Registry: `getProvider(code)` di `provider-registry.ts`.

## 3. Runtime services

`src/features/signature/services/`
- `signature-runtime.service.ts` — `createRequest(generated_document_id, providerCode, mode, signers[])`, hitung SHA-256 dari signed-file/source, simpan `file_hash`, kirim ke provider, log event `requested`+`sent`.
- `signature-queue.service.ts` — listing + filter (status, provider, signer, tanggal, OPD).
- `signature-monitoring.service.ts` — aggregate counts (pending/rejected/expired/completed/failed) tanpa chart KPI.
- `qr-verification.service.ts` — generate URL `/verify-doc/{token}`, hitung & bandingkan hash.
- `signer-resolver.service.ts` — resolve `user|role|position` → user_id (mirip assignment engine).
- `webhook.service.ts` — verifikasi signature webhook (HMAC SHA-256 timing-safe) per provider, advance sequential step, mark signed/rejected/expired, simpan signed file ke bucket `signed-documents`, update `generated_documents.status='signed'` + `signed_document_id` + `archived_at` jika sesuai.
- `retry.service.ts` — resend ke provider tanpa membuat request baru (update external_request_id + reset status pending).

## 4. Workflow integration

Edit `src/features/workflows/runtime/workflow-runtime.service.ts`:
- Saat node bertipe `digital_signature` ATAU saat finalizeSubmission jika workflow snapshot config `requires_signature=true` → panggil `createRequest`. Tidak blocking: status submission jadi `awaiting_signature`; lanjut ke `completed` saat webhook signed.
- Tidak mengubah API publik service lain.

## 5. Server functions

`src/lib/signature.functions.ts` (createServerFn + `requireSupabaseAuth`):
- `sigSendDocument({ generatedDocumentId, providerCode, mode, signers })`
- `sigGetStatus({ requestId })`
- `sigRetry({ requestId })` (admin only)
- `sigCancel({ requestId, reason })`
- `sigListQueue({ filters })`
- `sigListMonitoring()`
- `sigGetVerification({ token })` — **publik**: tanpa middleware auth, hanya field aman (doc number, name, date, signer name+position, signed_at, status, hash, hash_match).
- `sigListProviders()` (admin)

## 6. Routes

Public:
- `src/routes/verify-doc.$token.tsx` — halaman verifikasi (server-side load via `sigGetVerification`), tampilkan field aman + status badge. Tidak menampilkan storage path / snapshot lengkap.

Admin (`_authenticated/admin.signature.*`):
- `admin.signature.tsx` (layout dengan tab)
- `admin.signature.index.tsx` → dashboard mini (monitoring counts + provider list)
- `admin.signature.queue.tsx` → tabel + filter + action (view, retry, cancel)
- `admin.signature.monitoring.tsx` → counts + table per status
- `admin.signature.providers.tsx` → enable/disable provider, update config (super_admin)
- `admin.signature.requests.$id.tsx` → detail request: signers timeline, events, link signed file (signed URL)

Sidebar group "Tanda Tangan Digital (TTE)" di `AdminShell`.

## 7. Webhook endpoint

`src/routes/api/public/hooks/signature-webhook.$provider.ts` — POST raw body. Lookup provider config, verify HMAC, parse event, dispatch ke `webhook.service.handleEvent()`. Selalu return 200 setelah event tersimpan (idempotent by `external_request_id + event_id`).

## 8. Hash & QR

- Saat `createRequest`: download bytes dari bucket `documents` (storage_path generated_documents), compute SHA-256 (Web Crypto), simpan ke `signature_requests.file_hash` dan `signed_documents.document_hash`.
- QR di-render di halaman verify-doc (pakai lib pure `qrcode` → SVG inline).
- Saat verify: re-fetch signed file → recompute hash → compare. Set `hashMatch` di response. Log `document_audit` action `VERIFIED` atau `HASH_MISMATCH`.

## 9. Audit & immutability

- Trigger di `signature_events`: BLOCK UPDATE/DELETE (raise exception), allow INSERT.
- Setiap aksi (request, send, webhook, retry, cancel, download) → INSERT `signature_events` + `document_audit`.

## 10. Security

- Provider webhook_secret disimpan di kolom (terenkripsi via pgsodium tidak tersedia → cukup secret table dengan RLS ketat super_admin-only) + ENV fallback `BSRE_WEBHOOK_SECRET`, `ESIGN_WEBHOOK_SECRET`.
- Public verification: rate-limit via existing `rate_limit_increment`.
- Storage: bucket `signed-documents` private; akses lewat signed URL 10 menit.
- Tidak ada `any`. Semua tipe di-derive dari `Database`.

## 11. Tidak diimplementasi

KPI / BI / executive dashboard / analytics chart — skip ke phase berikutnya.

## 12. Deliverables

- 1 migration SQL (3 tabel + RLS + GRANT + trigger immutability + index)
- Provider layer (`types.ts`, `mock.ts`, `bsre.ts`, `esign.ts`, `registry.ts`)
- 6 service files
- 1 server functions file (8 functions)
- Webhook route
- 1 public verify-doc route
- 5 admin route files + sidebar entry
- Workflow runtime hook (1 file edit)
- `qrcode` npm dependency

Setelah disetujui akan dijalankan migrasi dulu, lalu kode.
