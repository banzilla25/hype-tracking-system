import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── POI counts by status ───────────────────────────────────────────────────
  const { data: poisRaw } = await supabase
    .from("pois")
    .select("status");

  // ── All claims with profile for aggregation ───────────────────────────────
  const { data: claimsRaw } = await supabase
    .from("claims")
    .select(`
      claim_id,
      claim_status,
      submitted_at,
      fixed_at,
      completed_at,
      release_reason,
      user_id,
      profiles ( nickname )
    `);

  // ── Aggregate per freelancer ───────────────────────────────────────────────
  type FreelancerRow = {
    user_id: string;
    nickname: string;
    total: number;
    submitted: number;
    gagal: number;
    autoRelease: number;
    campaignSelesai: number;
  };

  const freelancerMap = new Map<string, FreelancerRow>();
  for (const c of (claimsRaw ?? [])) {
    const profile = c.profiles as { nickname: string } | null;
    const nickname = profile?.nickname ?? c.user_id;
    if (!freelancerMap.has(c.user_id)) {
      freelancerMap.set(c.user_id, {
        user_id: c.user_id,
        nickname,
        total: 0,
        submitted: 0,
        gagal: 0,
        autoRelease: 0,
        campaignSelesai: 0,
      });
    }
    const row = freelancerMap.get(c.user_id)!;
    row.total += 1;
    if (c.submitted_at) row.submitted += 1;
    if (c.claim_status === "gagal" && !c.release_reason) row.gagal += 1;
    if (c.claim_status === "gagal" && c.release_reason === "inactivity") row.autoRelease += 1;
    if (c.claim_status === "campaign_selesai") row.campaignSelesai += 1;
  }

  const freelancers = Array.from(freelancerMap.values()).sort(
    (a, b) => b.submitted - a.submitted
  );

  // ── Status counts for funnel ───────────────────────────────────────────────
  const statusCounts = (poisRaw ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  // ── High-level summary ────────────────────────────────────────────────────
  const totalPoi = (poisRaw ?? []).length;
  const totalDikunjungi = (claimsRaw ?? []).length;
  const totalSubmitted = (claimsRaw ?? []).filter((c) => c.submitted_at).length;
  const totalSelesai = (claimsRaw ?? []).filter(
    (c) => c.claim_status === "campaign_selesai"
  ).length;

  return (
    <DashboardClient
      statusCounts={statusCounts}
      totalPoi={totalPoi}
      totalDikunjungi={totalDikunjungi}
      totalSubmitted={totalSubmitted}
      totalSelesai={totalSelesai}
      freelancers={freelancers}
    />
  );
}
