-- Rollback for Batch B
GRANT EXECUTE ON FUNCTION public.fn_retention_cleanup()                       TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_susut_bulanan_run(text)                   TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrasi_dataset_ke_forms(uuid)               TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_generate_nomor_surat(uuid, uuid)          TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_increment(text, text, timestamptz) TO PUBLIC;
