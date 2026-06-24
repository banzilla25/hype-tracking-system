import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import TaskDetailClient, { type HistoryEntry, type NoteEntry } from "@/components/task-detail-client";

export default async function TaskDetailPage({
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
  const { data: claimRaw, error: claimError } = await supabase
    .from("claims")
    .select(
      `claim_id, user_id, claim_status, pic_name, pic_position,
       wa_number, fail_reason, submitted_at, last_activity_at, poi_id`
    )
    .eq("claim_id", claimId)
    .single();

  if (claimError) {
    console.error("[tasks/[claimId]] Gagal load claim:", claimError);
    throw new Error(`Gagal memuat data klaim (claim_id=${claimId}): ${claimError.message}`);
  }
  if (!claimRaw) notFound();

  // Query 2: poi secara terpisah
  const { data: poiRaw } = await supabase
    .from("pois")
    .select("poi_id, name, category, area, city, is_undersupplied, priority_tag, approval_status")
    .eq("poi_id", claimRaw.poi_id)
    .single();

  const poi = poiRaw ?? {
    poi_id: claimRaw.poi_id,
    name: "POI tidak ditemukan",
    category: "lainnya",
    area: "",
    city: "",
    is_undersupplied: null,
    priority_tag: null,
    approval_status: "approved",
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

  // Status history
  const { data: historyRaw } = await supabase
    .from("status_history")
    .select("history_id, from_status, to_status, changed_by_role, note, created_at, profiles(nickname)")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });

  // Notes (RLS menyembunyikan internal-only untuk freelancer)
  const { data: notesRaw } = await supabase
    .from("notes")
    .select("note_id, author_id, phase, is_internal_only, note_text, created_at, profiles(nickname)")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });

  return (
    <TaskDetailClient
      claim={claimRaw}
      poi={poi}
      proofFiles={proofFiles}
      history={(historyRaw ?? []) as unknown as HistoryEntry[]}
      notes={(notesRaw ?? []) as unknown as NoteEntry[]}
    />
  );
}
