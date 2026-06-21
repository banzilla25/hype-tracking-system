-- ============================================================
-- HYPE Tracking System — Migration 013
-- Tutup race condition limit 10 POI aktif per freelancer.
--
-- Sebelumnya limit ini dicek dengan pola "SELECT COUNT lalu INSERT"
-- di 3 tempat berbeda (claim_poi RPC, addPoiToPool, addApproachedPoi)
-- — kalau user submit dua kali nyaris bersamaan, kedua request bisa
-- lolos cek sebelum salah satu commit, hasilnya bisa lebih dari 10
-- klaim aktif. Trigger ini jadi penjaga terakhir di level DB yang
-- pasti atomik (pakai advisory lock per user), berlaku untuk SEMUA
-- jalur insert klaim tanpa perlu duplikasi logic di tiap fungsi.
--
-- Run: Supabase Dashboard → SQL Editor → paste & Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_claim_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role         text;
  v_active_count int;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id;

  -- Limit hanya berlaku untuk freelancer (internal sourcing F&B tidak dibatasi)
  IF v_role = 'freelancer' THEN
    -- Kunci per-user: serialisasi insert paralel untuk user yang sama
    -- supaya COUNT di bawah tidak race. Lock otomatis lepas saat transaksi selesai.
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

    SELECT COUNT(*) INTO v_active_count
    FROM claims
    WHERE user_id = NEW.user_id
      AND claim_status NOT IN (
        'gagal', 'poi_mati', 'declined', 'campaign_selesai', 'repeat_campaign'
      );

    IF v_active_count >= 10 THEN
      RAISE EXCEPTION 'Batas maksimal 10 POI aktif sudah tercapai. Selesaikan atau lepas salah satu dulu.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_claim_limit ON public.claims;
CREATE TRIGGER trg_enforce_claim_limit
  BEFORE INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_claim_limit();
