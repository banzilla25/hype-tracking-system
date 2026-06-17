import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LeadsPageClient, { type Lead } from "@/components/leads-page-client";

const FASE2_STATUSES = [
  "submitted",
  "validasi_nomor",
  "nomor_invalid",
  "fiksasi_kerjasama",
  "disetujui_diklaim",
  "koordinasi_kreator",
  "campaign_jalan",
  "campaign_selesai",
];

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Query 1: claims (tanpa join pois — hindari RLS circular issue)
  const { data: claimsRaw } = await supabase
    .from("claims")
    .select(
      `claim_id, claim_status, submitted_at, last_activity_at,
       pic_name, wa_number, poi_id,
       profiles (nickname)`
    )
    .in("claim_status", FASE2_STATUSES)
    .order("last_activity_at", { ascending: false });

  // Query 2: ambil pois yang dibutuhkan secara terpisah
  const poiIds = [...new Set((claimsRaw ?? []).map((c) => c.poi_id))];
  const poisMap: Record<string, { name: string; category: string; area: string; city: string; source: string }> = {};

  if (poiIds.length > 0) {
    const { data: pois } = await supabase
      .from("pois")
      .select("poi_id, name, category, area, city, source")
      .in("poi_id", poiIds);
    for (const poi of pois ?? []) {
      poisMap[poi.poi_id] = { name: poi.name, category: poi.category, area: poi.area, city: poi.city, source: poi.source };
    }
  }

  // Gabungkan
  const leads: Lead[] = (claimsRaw ?? []).map((c) => {
    const { profiles, ...rest } = c as typeof c & { profiles: { nickname: string } | null };
    return {
      ...rest,
      pois: poisMap[c.poi_id] ?? null,
      profiles,
    };
  });

  return <LeadsPageClient leads={leads} />;
}
