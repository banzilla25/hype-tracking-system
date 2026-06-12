-- ============================================================
-- HYPE Tracking System — Migration 004
-- 1. Update transition_claim_status (tambah field Fase 2)
-- 2. Fungsi source_poi_internal (sourcing F&B mandiri)
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── Update transition_claim_status: tambah parameter Fase 2 ──────────────
CREATE OR REPLACE FUNCTION public.transition_claim_status(
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
  p_creator_visit_date     timestamptz DEFAULT NULL
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
BEGIN
  SELECT * INTO v_claim FROM claims WHERE claim_id = p_claim_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Klaim tidak ditemukan');
  END IF;

  v_from := v_claim.claim_status;

  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pengguna tidak ditemukan');
  END IF;

  -- Otorisasi
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
    (v_from = 'campaign_selesai'   AND p_to_status = 'repeat_campaign')
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
    IF p_campaign_target_videos IS NULL OR p_campaign_target_videos < 1 THEN
      RETURN jsonb_build_object('error', 'Target video wajib diisi (minimum 1)');
    END IF;
  END IF;

  v_note_text := CASE
    WHEN p_to_status IN ('gagal', 'poi_mati', 'nomor_invalid', 'declined') THEN p_fail_reason
    ELSE p_note
  END;

  -- Update klaim
  UPDATE claims SET
    claim_status               = p_to_status,
    fail_reason                = CASE WHEN p_fail_reason           IS NOT NULL THEN p_fail_reason           ELSE fail_reason           END,
    pic_name                   = CASE WHEN p_pic_name              IS NOT NULL THEN p_pic_name              ELSE pic_name              END,
    wa_number                  = CASE WHEN p_wa_number             IS NOT NULL THEN p_wa_number             ELSE wa_number             END,
    pic_position               = CASE WHEN p_pic_position          IS NOT NULL THEN p_pic_position          ELSE pic_position          END,
    deal_type                  = CASE WHEN p_deal_type             IS NOT NULL THEN p_deal_type             ELSE deal_type             END,
    campaign_target_videos     = CASE WHEN p_campaign_target_videos IS NOT NULL THEN p_campaign_target_videos ELSE campaign_target_videos END,
    creator_visit_date         = CASE WHEN p_creator_visit_date    IS NOT NULL THEN p_creator_visit_date    ELSE creator_visit_date    END,
    cooperation_result         = CASE
                                   WHEN p_to_status = 'disetujui_diklaim' THEN 'agreed'
                                   WHEN p_to_status = 'declined'          THEN 'declined'
                                   ELSE cooperation_result
                                 END,
    wa_validated_by_bd         = CASE WHEN p_to_status = 'fiksasi_kerjasama' THEN true ELSE wa_validated_by_bd END,
    wa_validated_by_freelancer = CASE WHEN p_to_status = 'submitted'          THEN true ELSE wa_validated_by_freelancer END,
    submitted_at               = CASE WHEN p_to_status = 'submitted'          THEN now() ELSE submitted_at END,
    validated_at               = CASE WHEN p_to_status = 'validasi_nomor'     THEN now() ELSE validated_at END,
    fixed_at                   = CASE WHEN p_to_status IN ('disetujui_diklaim', 'declined') THEN now() ELSE fixed_at END,
    campaign_started_at        = CASE WHEN p_to_status = 'campaign_jalan'     THEN now() ELSE campaign_started_at END,
    completed_at               = CASE WHEN p_to_status = 'campaign_selesai'   THEN now() ELSE completed_at END,
    is_retryable               = CASE
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


-- ── Sourcing POI internal (langsung masuk pipeline Fase 2) ────────────────
CREATE OR REPLACE FUNCTION public.source_poi_internal(
  p_poi_id         text,
  p_name           text,
  p_category       text,
  p_city           text,
  p_area           text,
  p_pic_name       text,
  p_wa_number      text,
  p_user_id        uuid,
  p_pic_position   text        DEFAULT NULL,
  p_aov            numeric     DEFAULT NULL,
  p_is_undersupplied boolean   DEFAULT NULL,
  p_priority_tag   text        DEFAULT NULL,
  p_source_campaign text       DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role  text;
  v_claim_id   bigint;
BEGIN
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF v_user_role != 'internal' THEN
    RETURN jsonb_build_object('error', 'Hanya internal yang bisa melakukan sourcing POI');
  END IF;

  IF EXISTS (SELECT 1 FROM pois WHERE poi_id = p_poi_id) THEN
    RETURN jsonb_build_object('error', 'POI ID sudah ada di database');
  END IF;

  IF trim(p_pic_name) = '' THEN
    RETURN jsonb_build_object('error', 'Nama PIC wajib diisi');
  END IF;

  IF trim(p_wa_number) = '' THEN
    RETURN jsonb_build_object('error', 'Nomor WhatsApp wajib diisi');
  END IF;

  -- Buat POI
  INSERT INTO pois (
    poi_id, name, category, city, area, aov, is_undersupplied,
    priority_tag, source, source_campaign, status
  ) VALUES (
    p_poi_id, p_name, lower(p_category), p_city, p_area,
    p_aov, p_is_undersupplied, p_priority_tag,
    'internal', p_source_campaign, 'in_progress'
  );

  -- Buat claim untuk internal user langsung di submitted
  INSERT INTO claims (
    poi_id, user_id, claim_status,
    pic_name, wa_number, pic_position,
    claimed_at, submitted_at,
    wa_validated_by_freelancer, last_activity_at
  )
  VALUES (
    p_poi_id, p_user_id, 'submitted',
    p_pic_name, p_wa_number, p_pic_position,
    now(), now(),
    true, now()
  )
  RETURNING claim_id INTO v_claim_id;

  -- Update POI ke submitted + link claim
  UPDATE pois
  SET status = 'submitted', current_claim_id = v_claim_id
  WHERE poi_id = p_poi_id;

  -- History: langsung masuk submitted
  INSERT INTO status_history (poi_id, claim_id, from_status, to_status, changed_by, changed_by_role, note)
  VALUES (p_poi_id, v_claim_id, NULL, 'submitted', p_user_id, 'internal', 'Internal sourcing');

  RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id);
END;
$$;
