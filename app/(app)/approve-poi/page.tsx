import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ApprovePoiClient, { type PendingPoi } from "@/components/approve-poi-client";

export default async function ApprovePoiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "internal") redirect("/pool");

  // POI yang masih menunggu approval (tanpa join claims — hindari RLS circular issue)
  const { data: pendingPois } = await supabase
    .from("pois")
    .select("poi_id, name, category, city, area, current_claim_id, created_at")
    .eq("approval_status", "pending")
    .order("created_at", { ascending: true });

  const claimIds = (pendingPois ?? [])
    .map((p) => p.current_claim_id)
    .filter((id): id is number => id !== null);

  const claimsMap: Record<number, { pic_name: string | null; wa_number: string | null; nickname: string }> = {};
  if (claimIds.length > 0) {
    const { data: claims } = await supabase
      .from("claims")
      .select("claim_id, pic_name, wa_number, profiles (nickname)")
      .in("claim_id", claimIds);
    for (const c of claims ?? []) {
      const profileData = c.profiles as unknown as { nickname: string } | null;
      claimsMap[c.claim_id] = {
        pic_name: c.pic_name,
        wa_number: c.wa_number,
        nickname: profileData?.nickname ?? "—",
      };
    }
  }

  const pending: PendingPoi[] = (pendingPois ?? []).map((p) => ({
    poi_id: p.poi_id,
    name: p.name,
    category: p.category,
    city: p.city,
    area: p.area,
    created_at: p.created_at,
    pic_name: p.current_claim_id ? claimsMap[p.current_claim_id]?.pic_name ?? null : null,
    wa_number: p.current_claim_id ? claimsMap[p.current_claim_id]?.wa_number ?? null : null,
    submitter_nickname: p.current_claim_id ? claimsMap[p.current_claim_id]?.nickname ?? "—" : "—",
  }));

  return <ApprovePoiClient pending={pending} />;
}
