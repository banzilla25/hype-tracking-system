import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PoolPageClient from "@/components/pool-page-client";

const TERMINAL_STATUSES = [
  "gagal",
  "poi_mati",
  "declined",
  "campaign_selesai",
  "repeat_campaign",
];

export default async function PoolPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cek-on-load: lepas klaim yang tidak aktif > 7 hari
  await supabase.rpc("auto_release_stale_claims");

  // Fetch POI untuk pool: available (bisa diklaim) + in_progress (tampil terkunci)
  const { data: pois } = await supabase
    .from("pois")
    .select(
      "poi_id, name, category, city, area, aov, is_undersupplied, priority_tag, status, current_claim_id"
    )
    .in("status", ["available", "in_progress"])
    .order("name");

  // Klaim aktif milik user (untuk slot indicator + filter POI sendiri dari pool)
  const { data: allUserClaims } = await supabase
    .from("claims")
    .select("claim_id, claim_status")
    .eq("user_id", user.id);

  const activeClaims =
    allUserClaims?.filter((c) => !TERMINAL_STATUSES.includes(c.claim_status)) ??
    [];

  const userClaimIds = activeClaims.map((c) => c.claim_id);
  const activeClaimCount = activeClaims.length;

  return (
    <PoolPageClient
      pois={pois ?? []}
      userClaimIds={userClaimIds}
      activeClaimCount={activeClaimCount}
    />
  );
}
