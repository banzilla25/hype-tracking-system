-- ============================================================
-- HYPE Tracking System — Migration 005
-- 1. Tabel notifications + RLS
-- 2. Trigger auto-buat notifikasi saat transisi status penting
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

-- ── Tabel notifications ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          uuid        NOT NULL REFERENCES public.profiles(id),
  claim_id         bigint      REFERENCES public.claims(claim_id),
  poi_id           text        REFERENCES public.pois(poi_id),
  type             text        NOT NULL,  -- 'nomor_invalid','disetujui_diklaim','declined'
  message          text        NOT NULL,
  is_read          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- User hanya bisa baca notif miliknya sendiri
CREATE POLICY "notif_select"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Update (mark as read) hanya milik sendiri
CREATE POLICY "notif_update"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger function yang membuat notifikasi saat status_history bertambah
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

  -- Hanya buat notifikasi untuk transisi tertentu
  CASE NEW.to_status
    WHEN 'nomor_invalid' THEN
      v_message := 'Nomor kontak pada ' || v_poi_name ||
                   ' ditandai tidak valid oleh tim internal. Perlu update kontak.';
    WHEN 'disetujui_diklaim' THEN
      v_message := 'Kerjasama dengan ' || v_poi_name || ' disetujui! Tim akan mengoordinasi kreator.';
    WHEN 'declined' THEN
      v_message := 'Kerjasama dengan ' || v_poi_name ||
                   ' tidak jadi dilanjutkan.' ||
                   CASE WHEN NEW.note IS NOT NULL THEN ' Alasan: ' || NEW.note ELSE '' END;
    WHEN 'campaign_jalan' THEN
      v_message := 'Campaign untuk ' || v_poi_name || ' sudah mulai jalan!';
    WHEN 'campaign_selesai' THEN
      v_message := 'Campaign untuk ' || v_poi_name || ' telah selesai. Terima kasih!';
    ELSE
      RETURN NEW; -- tidak ada notifikasi untuk transisi lain
  END CASE;

  INSERT INTO public.notifications (user_id, claim_id, poi_id, type, message)
  VALUES (v_user_id, NEW.claim_id, NEW.poi_id, NEW.to_status, v_message);

  RETURN NEW;
END;
$$;

-- Pasang trigger ke status_history
CREATE TRIGGER trg_notify_on_transition
  AFTER INSERT ON public.status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_transition();
