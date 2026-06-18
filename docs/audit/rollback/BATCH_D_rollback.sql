-- Rollback for Batch D (search_path hardening)
ALTER FUNCTION public.tg_pengajuan_izin_set_saldo_flag() RESET ALL;
ALTER FUNCTION public.tg_bump_version_number()           RESET ALL;
