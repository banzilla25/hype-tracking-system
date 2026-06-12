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

  const { data: claimRaw } = await supabase
    .from("claims")
    .select(
      `
      claim_id,
      user_id,
      claim_status,
      pic_name,
      pic_position,
      wa_number,
      fail_reason,
      submitted_at,
      last_activity_at,
      poi_id,
      pois (
        poi_id,
        name,
        category,
        area,
        city,
        is_undersupplied,
        priority_tag
      )
    `
    )
    .eq("claim_id", claimId)
    .single();

  if (!claimRaw) notFound();

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

  const { pois: poi, ...claim } = claimRaw as typeof claimRaw & {
    pois: {
      poi_id: string;
      name: string;
      category: string;
      area: string;
      city: string;
      is_undersupplied: boolean | null;
      priority_tag: string | null;
    };
  };

  return (
    <TaskDetailClient
      claim={claim}
      poi={poi}
      proofFiles={proofFiles}
      history={(historyRaw ?? []) as unknown as HistoryEntry[]}
      notes={(notesRaw ?? []) as unknown as NoteEntry[]}
    />
  );
}
