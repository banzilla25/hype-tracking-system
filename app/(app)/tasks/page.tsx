import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TasksPageClient, { type TaskClaim } from "@/components/tasks-page-client";

const TERMINAL_STATUSES = [
  "gagal",
  "poi_mati",
  "declined",
  "campaign_selesai",
  "repeat_campaign",
];

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cek-on-load: lepas klaim yang tidak aktif > 7 hari
  await supabase.rpc("auto_release_stale_claims");

  // Query 1: ambil semua klaim milik user (tanpa join pois — hindari RLS circular issue)
  const { data: allClaims } = await supabase
    .from("claims")
    .select("claim_id, claim_status, pic_name, wa_number, last_activity_at, poi_id")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false });

  // Filter terminal di JS (konsisten dengan pool page)
  const activeClaims = (allClaims ?? []).filter(
    (c) => !TERMINAL_STATUSES.includes(c.claim_status)
  );

  // Query 2: ambil data pois yang dibutuhkan secara terpisah
  const poiIds = activeClaims.map((c) => c.poi_id);
  const poisMap: Record<string, { name: string; category: string; area: string; city: string; is_undersupplied: boolean | null }> = {};

  if (poiIds.length > 0) {
    const { data: pois } = await supabase
      .from("pois")
      .select("poi_id, name, category, area, city, is_undersupplied")
      .in("poi_id", poiIds);

    for (const poi of pois ?? []) {
      poisMap[poi.poi_id] = {
        name: poi.name,
        category: poi.category,
        area: poi.area,
        city: poi.city,
        is_undersupplied: poi.is_undersupplied,
      };
    }
  }

  // Gabungkan
  const claims: TaskClaim[] = activeClaims.map((c) => ({
    claim_id: c.claim_id,
    claim_status: c.claim_status,
    pic_name: c.pic_name,
    wa_number: c.wa_number,
    last_activity_at: c.last_activity_at,
    poi_id: c.poi_id,
    pois: poisMap[c.poi_id] ?? null,
  }));

  return <TasksPageClient claims={claims} />;
}
