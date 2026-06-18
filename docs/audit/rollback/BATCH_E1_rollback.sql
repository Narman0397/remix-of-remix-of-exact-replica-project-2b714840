-- Rollback Batch E1 — restore PUBLIC EXECUTE pada trigger functions.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'aset_set_qr_token()',
    'handle_new_user()',
    'log_permohonan_change()',
    'prevent_unverified_role_insert()',
    'prevent_self_role_change()',
    'set_updated_at()',
    'sync_compliance_aliases()',
    'sync_dataset_submission_aliases()',
    'sync_dataset_review_aliases()',
    'sync_dataset_template_aliases()',
    'sync_feature_flag_aliases()',
    'sync_uat_aliases()',
    'tg_signed_documents_validate_revoke()'
  ] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO PUBLIC', r);
  END LOOP;
END $$;
