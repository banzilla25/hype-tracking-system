-- ============================================================
-- HYPE Tracking System — Migration 014
-- Lengkapi notifikasi yang sebelumnya bolong di transisi:
-- submitted, validasi_nomor, fiksasi_kerjasama, koordinasi_kreator,
-- repeat_campaign. Sebelumnya freelancer cuma dapat sinyal lewat
-- 5 transisi (nomor_invalid, disetujui_diklaim, declined,
-- campaign_jalan, campaign_selesai) — banyak tahap di tengah jadi
-- "diam" dan freelancer/internal harus cek manual ke halaman.
--
-- 'submitted' khusus dikirim ke SEMUA internal (bukan ke freelancer
-- pengirim sendiri), karena itu yang sebenarnya perlu tahu ada
-- antrian baru masuk.
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_notification_on_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid;
  v_poi_name text;
  v_message  text;
  v_internal uuid;
BEGIN
  -- Ambil owner klaim + nama POI
  SELECT c.user_id, p.name
  INTO v_user_id, v_poi_name
  FROM claims c
  JOIN pois p ON p.poi_id = c.poi_id
  WHERE c.claim_id = NEW.claim_id;

  IF NOT FOUND OR v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 'submitted': notifikasi ke SEMUA internal (bukan ke freelancer pengirim)
  IF NEW.to_status = 'submitted' THEN
    FOR v_internal IN
      SELECT id FROM profiles
      WHERE role = 'internal' AND id IS DISTINCT FROM NEW.changed_by
    LOOP
      INSERT INTO public.notifications (user_id, claim_id, poi_id, type, message)
      VALUES (
        v_internal, NEW.claim_id, NEW.poi_id, 'submitted',
        v_poi_name || ' baru disubmit, menunggu review tim internal.'
      );
    END LOOP;
    RETURN NEW;
  END IF;

  -- Sisanya: notifikasi ke freelancer pemilik klaim
  CASE NEW.to_status
    WHEN 'validasi_nomor' THEN
      v_message := 'Nomor kontak untuk ' || v_poi_name || ' sedang divalidasi tim internal.';
    WHEN 'fiksasi_kerjasama' THEN
      v_message := 'Nomor untuk ' || v_poi_name || ' valid! Tim internal sedang fiksasi kerjasama.';
    WHEN 'nomor_invalid' THEN
      v_message := 'Nomor kontak pada ' || v_poi_name ||
                   ' ditandai tidak valid oleh tim internal. Perlu update kontak.';
    WHEN 'disetujui_diklaim' THEN
      v_message := 'Kerjasama dengan ' || v_poi_name || ' disetujui! Tim akan mengoordinasi kreator.';
    WHEN 'declined' THEN
      v_message := 'Kerjasama dengan ' || v_poi_name ||
                   ' tidak jadi dilanjutkan.' ||
                   CASE WHEN NEW.note IS NOT NULL THEN ' Alasan: ' || NEW.note ELSE '' END;
    WHEN 'koordinasi_kreator' THEN
      v_message := 'Kerjasama dengan ' || v_poi_name || ' fix! Tim sedang atur jadwal kreator visit.';
    WHEN 'campaign_jalan' THEN
      v_message := 'Campaign untuk ' || v_poi_name || ' sudah mulai jalan!';
    WHEN 'campaign_selesai' THEN
      v_message := 'Campaign untuk ' || v_poi_name || ' telah selesai. Terima kasih!';
    WHEN 'repeat_campaign' THEN
      v_message := v_poi_name || ' ditandai untuk repeat campaign periode baru.';
    ELSE
      RETURN NEW; -- tidak ada notifikasi untuk transisi lain
  END CASE;

  INSERT INTO public.notifications (user_id, claim_id, poi_id, type, message)
  VALUES (v_user_id, NEW.claim_id, NEW.poi_id, NEW.to_status, v_message);

  RETURN NEW;
END;
$$;
