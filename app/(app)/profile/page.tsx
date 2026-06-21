import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "@/components/profile-client";
import { FEE_LOCKED_STATUSES, FEE_PER_VALIDATED_POI, type PoiStatus } from "@/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, role, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Statistik klaim milik freelancer
  const { data: claimsRaw } = await supabase
    .from("claims")
    .select("claim_id, claim_status, submitted_at, release_reason, completed_at")
    .eq("user_id", user.id);

  const claims = claimsRaw ?? [];

  const feeAmanCount = claims.filter((c) =>
    FEE_LOCKED_STATUSES.includes(c.claim_status as PoiStatus)
  ).length;

  const stats = {
    total:          claims.length,
    aktif:          claims.filter((c) =>
      !["gagal", "poi_mati", "campaign_selesai", "repeat_campaign", "declined"].includes(c.claim_status)
    ).length,
    submitted:      claims.filter((c) => c.submitted_at).length,
    gagal:          claims.filter((c) => c.claim_status === "gagal" && !c.release_reason).length,
    autoRelease:    claims.filter((c) => c.release_reason === "inactivity").length,
    selesai:        claims.filter((c) => c.claim_status === "campaign_selesai").length,
    feeAmanCount,
    totalFee:       feeAmanCount * FEE_PER_VALIDATED_POI,
  };

  return (
    <ProfileClient
      nickname={profile.nickname}
      email={user.email ?? ""}
      role={profile.role}
      joinedAt={profile.created_at}
      stats={stats}
    />
  );
}
