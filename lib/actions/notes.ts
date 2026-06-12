"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const AKUISISI_STATUSES = ["in_progress", "semi_dealing", "submitted", "gagal", "poi_mati"];

export async function addNote(
  claimId: number,
  noteText: string,
  isInternalOnly: boolean = false
): Promise<{ error?: string }> {
  if (!noteText.trim()) return { error: "Catatan tidak boleh kosong" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  // Cek role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profil tidak ditemukan" };

  // Freelancer tidak bisa buat internal-only note
  if (isInternalOnly && profile.role !== "internal") {
    return { error: "Hanya internal yang bisa membuat catatan internal" };
  }

  // Cek status klaim untuk menentukan phase
  const { data: claim } = await supabase
    .from("claims")
    .select("claim_id, claim_status")
    .eq("claim_id", claimId)
    .single();
  if (!claim) return { error: "Klaim tidak ditemukan" };

  const phase = AKUISISI_STATUSES.includes(claim.claim_status) ? "akuisisi" : "campaign";

  const { error } = await supabase.from("notes").insert({
    claim_id: claimId,
    author_id: user.id,
    phase,
    is_internal_only: isInternalOnly,
    note_text: noteText.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath(`/tasks/${claimId}`);
  revalidatePath(`/leads/${claimId}`);
  return {};
}
