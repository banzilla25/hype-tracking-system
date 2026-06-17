import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import LeadDetailClient, { type HistoryEntry, type NoteEntry } from "@/components/lead-detail-client";

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

  // Query 1: claim (tanpa join pois — hindari RLS circular issue)
  const { data: claimRaw } = await supabase
    .from("claims")
    .select(
      `claim_id, user_id, claim_status, pic_name, pic_position,
       wa_number, wa_validated_by_freelancer, wa_validated_by_bd,
       fail_reason, deal_type, cooperation_result,
       campaign_target_videos, campaign_uploaded_videos,
       creator_visit_date, submitted_at, validated_at,
       fixed_at, campaign_started_at, completed_at,
       last_activity_at, poi_id,
       profiles (nickname)`
    )
    .eq("claim_id", claimId)
    .single();

  if (!claimRaw) notFound();

  // Query 2: poi secara terpisah
  const { data: poiRaw } = await supabase
    .from("pois")
    .select("poi_id, name, category, area, city, is_undersupplied, priority_tag, source")
    .eq("poi_id", claimRaw.poi_id)
    .single();

  const poi = poiRaw ?? {
    poi_id: claimRaw.poi_id,
    name: claimRaw.poi_id,
    category: "lainnya",
    area: "",
    city: "",
    is_undersupplied: null,
    priority_tag: null,
    source: "internal",
  };

  // Proof files dengan signed URLs
  const { data: proofFilesRaw } = await supabase
    .from("proof_files")
    .select("file_id, file_type, file_url, uploaded_at")
    .eq("claim_id", claimId)
    .order("uploaded_at");

  const proofFiles = await Promise.all(
    (proofFilesRaw ?? []).map(async (f) => {
      const { data } = await supabase.storage
        .from("proof-files")
        .createSignedUrl(f.file_url, 3600);
      return { ...f, signedUrl: data?.signedUrl ?? null };
    })
  );

  const { profiles: submitterProfileRaw, ...claim } = claimRaw as typeof claimRaw & {
    profiles: { nickname: string } | null;
  };

  // Status history + notes
  const { data: historyRaw } = await supabase
    .from("status_history")
    .select("history_id, from_status, to_status, changed_by_role, note, created_at, profiles(nickname)")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });

  const { data: notesRaw } = await supabase
    .from("notes")
    .select("note_id, author_id, phase, is_internal_only, note_text, created_at, profiles(nickname)")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });

  return (
    <LeadDetailClient
      claim={claim}
      poi={poi}
      proofFiles={proofFiles}
      submitterNickname={submitterProfileRaw?.nickname ?? "—"}
      history={(historyRaw ?? []) as unknown as HistoryEntry[]}
      notes={(notesRaw ?? []) as unknown as NoteEntry[]}
    />
  );
}
