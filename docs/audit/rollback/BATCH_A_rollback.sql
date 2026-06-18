-- Rollback for Batch A
ALTER VIEW public.aset_nilai_buku      SET (security_invoker = false);
ALTER VIEW public.v_permohonan_overdue SET (security_invoker = false);
