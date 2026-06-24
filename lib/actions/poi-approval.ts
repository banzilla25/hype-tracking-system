"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── Helper: pastikan user internal ────────────────────────────────────────
async function requireInternal() {
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
  return { supabase, user };
}

// ── Approve POI baru dari freelancer ─────────────────────────────────────
export async function approvePoiSubmission(poiId: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireInternal();

  const { data, error } = await supabase.rpc("approve_poi_submission", {
    p_poi_id:  poiId,
    p_user_id: user.id,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/approve-poi");
  revalidatePath("/pool");
  return {};
}

// ── Reject POI baru dari freelancer (hapus + notif alasan) ───────────────
export async function rejectPoiSubmission(
  poiId: string,
  reason: string
): Promise<{ error?: string }> {
  const { supabase, user } = await requireInternal();

  const { data, error } = await supabase.rpc("reject_poi_submission", {
    p_poi_id:  poiId,
    p_user_id: user.id,
    p_reason:  reason,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/approve-poi");
  revalidatePath("/pool");
  return {};
}
