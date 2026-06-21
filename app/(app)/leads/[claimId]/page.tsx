import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import LeadDetailClient, { type HistoryEntry, type NoteEntry, type CampaignRound } from "@/components/lead-detail-client";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ claimId: string }>;
}) {
  const { claimId: claimIdStr } = await params;
  const claimId = parseInt(claimIdStr, 10);
  if (isNaN(claimId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Batch 1: query yang hanya butuh claimId/user.id, dijalankan paralel
  const [
    { data: currentProfile },
    { data: claimRaw },
    { data: proofFilesRaw },
    { data: historyRaw },
    { data: notesRaw },
    { data: campaignRoundsRaw },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    // claim (tanpa join pois — hindari RLS circular issue)
    supabase
      .from("claims")
      .select(
        `claim_id, user_id, claim_status, pic_name, pic_position,
         wa_number, wa_validated_by_freelancer, wa_validated_by_bd,
         fail_reason, deal_type, cooperation_result,
         campaign_target_videos, campaign_uploaded_videos,
         campaign_target_kreator, campaign_actual_kreator,
         campaign_target_gmv, campaign_actual_gmv,
         campaign_target_orders, campaign_actual_orders,
         creator_visit_date, submitted_at, validated_at,
         fixed_at, campaign_started_at, completed_at,
         last_activity_at, poi_id,
         profiles (nickname)`
      )
      .eq("claim_id", claimId)
      .single(),
    supabase
      .from("proof_files")
      .select("file_id, file_type, file_url, uploaded_at")
      .eq("claim_id", claimId)
      .order("uploaded_at"),
    supabase
      .from("status_history")
      .select("history_id, from_status, to_status, changed_by_role, note, created_at, profiles(nickname)")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true }),
    supabase
      .from("notes")
      .select("note_id, author_id, phase, is_internal_only, note_text, created_at, profiles(nickname)")
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true }),
    supabase
      .from("campaign_rounds")
      .select(`round_id, round_number, target_videos, uploaded_videos,
                target_kreator, actual_kreator, target_gmv, actual_gmv,
                target_orders, actual_orders,
                creator_visit_date, started_at, completed_at`)
      .eq("claim_id", claimId)
      .order("round_number", { ascending: true }),
  ]);

  if (!claimRaw) notFound();
  const isInternal = currentProfile?.role === "internal";

  // Batch 2: poi (butuh poi_id dari claim) + signed url proof files, paralel
  const [{ data: poiRaw }, proofFiles] = await Promise.all([
    supabase
      .from("pois")
      .select("poi_id, name, category, area, city, is_undersupplied, priority_tag, source, source_campaign")
      .eq("poi_id", claimRaw.poi_id)
      .single(),
    Promise.all(
      (proofFilesRaw ?? []).map(async (f) => {
        const { data } = await supabase.storage
          .from("proof-files")
          .createSignedUrl(f.file_url, 3600);
        return { ...f, signedUrl: data?.signedUrl ?? null };
      })
    ),
  ]);

  const poi = poiRaw ?? {
    poi_id: claimRaw.poi_id,
    name: "POI tidak ditemukan",
    category: "lainnya",
    area: "",
    city: "",
    is_undersupplied: null,
    priority_tag: null,
    source: "internal",
    source_campaign: null,
  };

  const { profiles: submitterProfileRaw, ...claim } = claimRaw as typeof claimRaw & {
    profiles: { nickname: string } | null;
  };

  return (
    <LeadDetailClient
      claim={claim}
      poi={poi}
      proofFiles={proofFiles}
      submitterNickname={submitterProfileRaw?.nickname ?? "—"}
      history={(historyRaw ?? []) as unknown as HistoryEntry[]}
      notes={(notesRaw ?? []) as unknown as NoteEntry[]}
      campaignRounds={(campaignRoundsRaw ?? []) as unknown as CampaignRound[]}
      isInternal={isInternal}
    />
  );
}
