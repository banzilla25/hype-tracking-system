-- ============================================================
-- HYPE Tracking System — Migration 015
-- Perbaikan: migration 011 menambah 3 parameter baru ke
-- transition_claim_status (11 → 14 param) tanpa DROP versi lama
-- dulu. Postgres menganggap signature berbeda = fungsi baru,
-- jadi sekarang ada 2 overload yang bikin "function name is not
-- unique". Karena SQL Editor jalanin satu file sebagai 1 transaksi,
-- error ini juga me-rollback ALTER TABLE ADD COLUMN di migration 011
-- — makanya kolom campaign_actual_kreator dkk belum benar-benar ada.
--
-- Migration ini:
-- 1. Re-apply semua ALTER TABLE ADD COLUMN (idempotent, aman diulang)
-- 2. DROP SEMUA overload transition_claim_status secara dinamis
--    (tidak hardcode signature, supaya tidak kejadian lagi)
-- 3. CREATE ulang versi final yang benar (14 param)
-- 4. Reload schema cache PostgREST
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── 1. Re-apply kolom baru (aman walau sudah ada / belum ada) ────────────
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS campaign_target_kreator int;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS campaign_actual_kreator int NOT NULL DEFAULT 0;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS campaign_target_gmv numeric;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS campaign_actual_gmv numeric NOT NULL DEFAULT 0;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS campaign_target_orders int;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS campaign_actual_orders int NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_rounds ADD COLUMN IF NOT EXISTS target_kreator int;
ALTER TABLE public.campaign_rounds ADD COLUMN IF NOT EXISTS actual_kreator int NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_rounds ADD COLUMN IF NOT EXISTS target_gmv numeric;
ALTER TABLE public.campaign_rounds ADD COLUMN IF NOT EXISTS actual_gmv numeric NOT NULL DEFAULT 0;
ALTER TABLE public.campaign_rounds ADD COLUMN IF NOT EXISTS target_orders int;
ALTER TABLE public.campaign_rounds ADD COLUMN IF NOT EXISTS actual_orders int NOT NULL DEFAULT 0;

-- ── 2. DROP semua overload transition_claim_status (dinamis, anti-ambigu) ──
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'transition_claim_status'
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END $$;

-- ── 3. CREATE versi final (14 param) ───────────────────────────────────────
CREATE FUNCTION public.transition_claim_status(
  p_claim_id               bigint,
  p_to_status              text,
  p_user_id                uuid,
  p_note                   text        DEFAULT NULL,
  p_fail_reason            text        DEFAULT NULL,
  p_pic_name               text        DEFAULT NULL,
  p_wa_number              text        DEFAULT NULL,
  p_pic_position           text        DEFAULT NULL,
  p_deal_type              text        DEFAULT NULL,
  p_campaign_target_videos int         DEFAULT NULL,
  p_creator_visit_date     timestamptz DEFAULT NULL,
  p_campaign_target_kreator int        DEFAULT NULL,
  p_campaign_target_gmv     numeric    DEFAULT NULL,
  p_campaign_target_orders  int        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim       claims%ROWTYPE;
  v_user_role   text;
  v_proof_count int;
  v_from        text;
  v_note_text   text;
  v_is_new_round boolean;
  v_has_target   boolean;
BEGIN
  SELECT * INTO v_claim FROM claims WHERE claim_id = p_claim_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Klaim tidak ditemukan');
  END IF;

  v_from := v_claim.claim_status;
  v_is_new_round := (v_from = 'repeat_campaign' AND p_to_status = 'campaign_jalan');
  v_has_target := (
    COALESCE(p_campaign_target_videos, 0) >= 1 OR
    COALESCE(p_campaign_target_kreator, 0) >= 1 OR
    COALESCE(p_campaign_target_gmv, 0) > 0 OR
    COALESCE(p_campaign_target_orders, 0) >= 1
  );

  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pengguna tidak ditemukan');
  END IF;

  -- Otorisasi: freelancer hanya ubah klaim sendiri & transisi Fase 1
  IF v_user_role = 'freelancer' THEN
    IF v_claim.user_id != p_user_id THEN
      RETURN jsonb_build_object('error', 'Tidak berwenang mengubah klaim ini');
    END IF;
    IF p_to_status NOT IN ('semi_dealing', 'gagal', 'poi_mati', 'submitted', 'in_progress') THEN
      RETURN jsonb_build_object('error', 'Freelancer tidak berwenang melakukan transisi ini');
    END IF;
  END IF;

  -- Validasi state machine
  IF NOT (
    (v_from = 'in_progress'        AND p_to_status IN ('semi_dealing', 'gagal', 'poi_mati'))         OR
    (v_from = 'semi_dealing'       AND p_to_status = 'submitted')                                    OR
    (v_from = 'submitted'          AND p_to_status = 'validasi_nomor')                               OR
    (v_from = 'validasi_nomor'     AND p_to_status IN ('fiksasi_kerjasama', 'nomor_invalid'))         OR
    (v_from = 'nomor_invalid'      AND p_to_status = 'in_progress')                                  OR
    (v_from = 'fiksasi_kerjasama'  AND p_to_status IN ('disetujui_diklaim', 'declined'))              OR
    (v_from = 'disetujui_diklaim'  AND p_to_status = 'koordinasi_kreator')                           OR
    (v_from = 'koordinasi_kreator' AND p_to_status = 'campaign_jalan')                               OR
    (v_from = 'campaign_jalan'     AND p_to_status = 'campaign_selesai')                             OR
    (v_from = 'campaign_selesai'   AND p_to_status = 'repeat_campaign')                              OR
    (v_from = 'repeat_campaign'    AND p_to_status = 'campaign_jalan')
  ) THEN
    RETURN jsonb_build_object(
      'error', format('Transisi %s → %s tidak diizinkan', v_from, p_to_status)
    );
  END IF;

  -- Validasi data per transisi
  IF p_to_status IN ('gagal', 'poi_mati', 'nomor_invalid', 'declined') THEN
    IF p_fail_reason IS NULL OR trim(p_fail_reason) = '' THEN
      RETURN jsonb_build_object('error', 'Alasan wajib diisi');
    END IF;
  END IF;

  IF p_to_status = 'semi_dealing' THEN
    IF p_pic_name IS NULL OR trim(p_pic_name) = '' THEN
      RETURN jsonb_build_object('error', 'Nama PIC wajib diisi');
    END IF;
    IF p_wa_number IS NULL OR trim(p_wa_number) = '' THEN
      RETURN jsonb_build_object('error', 'Nomor WhatsApp wajib diisi');
    END IF;
  END IF;

  IF p_to_status = 'submitted' THEN
    IF COALESCE(trim(v_claim.pic_name), '') = '' THEN
      RETURN jsonb_build_object('error', 'Nama PIC belum diisi. Edit kontak dulu.');
    END IF;
    IF COALESCE(trim(v_claim.wa_number), '') = '' THEN
      RETURN jsonb_build_object('error', 'Nomor WhatsApp belum diisi. Edit kontak dulu.');
    END IF;
    SELECT COUNT(*) INTO v_proof_count FROM proof_files WHERE claim_id = p_claim_id;
    IF v_proof_count = 0 THEN
      RETURN jsonb_build_object('error', 'Upload minimal 1 bukti foto/screenshot sebelum submit');
    END IF;
  END IF;

  IF p_to_status = 'disetujui_diklaim' THEN
    IF p_deal_type IS NULL OR p_deal_type NOT IN ('buka_kamar', 'voucher_makanan') THEN
      RETURN jsonb_build_object('error', 'Deal type wajib dipilih (buka_kamar / voucher_makanan)');
    END IF;
    IF NOT v_has_target THEN
      RETURN jsonb_build_object('error', 'Minimal isi salah satu target (video/kreator/GMV/orders)');
    END IF;
  END IF;

  IF v_is_new_round THEN
    IF NOT v_has_target THEN
      RETURN jsonb_build_object('error', 'Minimal isi salah satu target round baru (video/kreator/GMV/orders)');
    END IF;
  END IF;

  v_note_text := CASE
    WHEN p_to_status IN ('gagal', 'poi_mati', 'nomor_invalid', 'declined') THEN p_fail_reason
    ELSE p_note
  END;

  -- Arsipkan round campaign sebelumnya sebelum direset untuk round baru
  IF v_is_new_round THEN
    INSERT INTO campaign_rounds (
      claim_id, round_number,
      target_videos, uploaded_videos,
      target_kreator, actual_kreator,
      target_gmv, actual_gmv,
      target_orders, actual_orders,
      creator_visit_date, started_at, completed_at
    )
    SELECT
      p_claim_id,
      COALESCE((SELECT MAX(round_number) FROM campaign_rounds WHERE claim_id = p_claim_id), 0) + 1,
      v_claim.campaign_target_videos, v_claim.campaign_uploaded_videos,
      v_claim.campaign_target_kreator, v_claim.campaign_actual_kreator,
      v_claim.campaign_target_gmv, v_claim.campaign_actual_gmv,
      v_claim.campaign_target_orders, v_claim.campaign_actual_orders,
      v_claim.creator_visit_date, v_claim.campaign_started_at, v_claim.completed_at;
  END IF;

  -- Update klaim
  UPDATE claims SET
    claim_status               = p_to_status,
    fail_reason                = CASE WHEN p_fail_reason            IS NOT NULL THEN p_fail_reason            ELSE fail_reason            END,
    pic_name                   = CASE WHEN p_pic_name               IS NOT NULL THEN p_pic_name               ELSE pic_name               END,
    wa_number                  = CASE WHEN p_wa_number              IS NOT NULL THEN p_wa_number              ELSE wa_number              END,
    pic_position                = CASE WHEN p_pic_position           IS NOT NULL THEN p_pic_position           ELSE pic_position           END,
    deal_type                  = CASE WHEN p_deal_type              IS NOT NULL THEN p_deal_type              ELSE deal_type              END,
    campaign_target_videos     = CASE WHEN p_campaign_target_videos  IS NOT NULL THEN p_campaign_target_videos  ELSE campaign_target_videos  END,
    campaign_uploaded_videos   = CASE WHEN v_is_new_round THEN 0 ELSE campaign_uploaded_videos END,
    campaign_target_kreator    = CASE WHEN p_campaign_target_kreator IS NOT NULL THEN p_campaign_target_kreator ELSE campaign_target_kreator END,
    campaign_actual_kreator    = CASE WHEN v_is_new_round THEN 0 ELSE campaign_actual_kreator END,
    campaign_target_gmv        = CASE WHEN p_campaign_target_gmv     IS NOT NULL THEN p_campaign_target_gmv     ELSE campaign_target_gmv     END,
    campaign_actual_gmv        = CASE WHEN v_is_new_round THEN 0 ELSE campaign_actual_gmv END,
    campaign_target_orders     = CASE WHEN p_campaign_target_orders  IS NOT NULL THEN p_campaign_target_orders  ELSE campaign_target_orders  END,
    campaign_actual_orders     = CASE WHEN v_is_new_round THEN 0 ELSE campaign_actual_orders END,
    creator_visit_date         = CASE WHEN p_creator_visit_date     IS NOT NULL THEN p_creator_visit_date     WHEN v_is_new_round THEN NULL ELSE creator_visit_date END,
    cooperation_result         = CASE
                                   WHEN p_to_status = 'disetujui_diklaim' THEN 'agreed'
                                   WHEN p_to_status = 'declined'          THEN 'declined'
                                   ELSE cooperation_result
                                 END,
    wa_validated_by_bd         = CASE WHEN p_to_status = 'fiksasi_kerjasama' THEN true ELSE wa_validated_by_bd         END,
    wa_validated_by_freelancer = CASE WHEN p_to_status = 'submitted'          THEN true ELSE wa_validated_by_freelancer END,
    submitted_at               = CASE WHEN p_to_status = 'submitted'          THEN now() ELSE submitted_at             END,
    validated_at                = CASE WHEN p_to_status = 'validasi_nomor'     THEN now() ELSE validated_at             END,
    fixed_at                   = CASE WHEN p_to_status IN ('disetujui_diklaim', 'declined') THEN now() ELSE fixed_at   END,
    campaign_started_at        = CASE WHEN p_to_status = 'campaign_jalan'     THEN now() ELSE campaign_started_at      END,
    completed_at                = CASE WHEN p_to_status = 'campaign_selesai'   THEN now() WHEN v_is_new_round THEN NULL ELSE completed_at END,
    is_retryable                = CASE
                                   WHEN p_to_status = 'gagal'    THEN true
                                   WHEN p_to_status = 'poi_mati' THEN false
                                   ELSE is_retryable
                                 END,
    last_activity_at           = now()
  WHERE claim_id = p_claim_id;

  INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (v_claim.poi_id, p_claim_id, v_from, p_to_status, p_user_id, v_user_role, v_note_text);

  -- Update status POI
  IF p_to_status = 'gagal' THEN
    UPDATE pois SET status = 'available', current_claim_id = NULL WHERE poi_id = v_claim.poi_id;
    INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role)
    VALUES (v_claim.poi_id, p_claim_id, 'gagal', 'available', p_user_id, v_user_role);
  ELSIF p_to_status IN ('poi_mati', 'declined') THEN
    UPDATE pois SET status = p_to_status, current_claim_id = NULL WHERE poi_id = v_claim.poi_id;
  ELSE
    UPDATE pois SET status = p_to_status WHERE poi_id = v_claim.poi_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_claim_status TO authenticated;

-- ── 4. Reload schema cache PostgREST ───────────────────────────────────────
NOTIFY pgrst, 'reload schema';
