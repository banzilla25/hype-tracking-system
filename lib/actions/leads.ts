"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { transitionStatus } from "./poi";

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

// ── Mulai validasi nomor (submitted → validasi_nomor) ─────────────────────
export async function startValidation(claimId: number): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "validasi_nomor");
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Nomor valid (validasi_nomor → fiksasi_kerjasama) ─────────────────────
export async function markNumberValid(claimId: number): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "fiksasi_kerjasama");
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Nomor invalid (validasi_nomor → nomor_invalid) ───────────────────────
export async function markNumberInvalid(
  claimId: number,
  reason: string
): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "nomor_invalid", { failReason: reason });
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Kerjasama setuju (fiksasi → disetujui_diklaim) ───────────────────────
export async function approveKerjasama(
  claimId: number,
  dealType: string,
  targetVideos: number,
  note?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("transition_claim_status", {
    p_claim_id:               claimId,
    p_to_status:              "disetujui_diklaim",
    p_user_id:                user.id,
    p_note:                   note ?? null,
    p_deal_type:              dealType,
    p_campaign_target_videos: targetVideos,
    p_fail_reason:            null,
    p_pic_name:               null,
    p_wa_number:              null,
    p_pic_position:           null,
    p_creator_visit_date:     null,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/leads");
  revalidatePath(`/leads/${claimId}`);
  return {};
}

// ── Declined (fiksasi → declined) ────────────────────────────────────────
export async function declineKerjasama(
  claimId: number,
  reason: string
): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "declined", { failReason: reason });
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Set koordinasi kreator (disetujui → koordinasi_kreator) ──────────────
export async function setKoordinasiKreator(
  claimId: number,
  creatorVisitDate?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const visitDateTs = creatorVisitDate ? new Date(creatorVisitDate).toISOString() : null;

  const { data, error } = await supabase.rpc("transition_claim_status", {
    p_claim_id:               claimId,
    p_to_status:              "koordinasi_kreator",
    p_user_id:                user.id,
    p_creator_visit_date:     visitDateTs,
    p_note:                   null,
    p_fail_reason:            null,
    p_pic_name:               null,
    p_wa_number:              null,
    p_pic_position:           null,
    p_deal_type:              null,
    p_campaign_target_videos: null,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/leads");
  revalidatePath(`/leads/${claimId}`);
  return {};
}

// ── Mulai campaign (koordinasi → campaign_jalan) ──────────────────────────
export async function startCampaign(claimId: number): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "campaign_jalan");
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Campaign selesai (campaign_jalan → campaign_selesai) ──────────────────
export async function completeCampaign(claimId: number): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "campaign_selesai");
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Repeat campaign (campaign_selesai → repeat_campaign) ─────────────────
export async function repeatCampaign(claimId: number): Promise<{ error?: string }> {
  await requireInternal();
  const res = await transitionStatus(claimId, "repeat_campaign");
  if (!res.error) {
    revalidatePath("/leads");
    revalidatePath(`/leads/${claimId}`);
  }
  return res;
}

// ── Mulai round repeat campaign baru (repeat_campaign → campaign_jalan) ──
export async function startRepeatRound(
  claimId: number,
  targetVideos: number,
  creatorVisitDate?: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const visitDateTs = creatorVisitDate ? new Date(creatorVisitDate).toISOString() : null;

  const { data, error } = await supabase.rpc("transition_claim_status", {
    p_claim_id:               claimId,
    p_to_status:              "campaign_jalan",
    p_user_id:                user.id,
    p_campaign_target_videos: targetVideos,
    p_creator_visit_date:     visitDateTs,
    p_note:                   null,
    p_fail_reason:            null,
    p_pic_name:               null,
    p_wa_number:              null,
    p_pic_position:           null,
    p_deal_type:              null,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/leads");
  revalidatePath(`/leads/${claimId}`);
  return {};
}

// ── Update jumlah video campaign (tanpa ubah status) ─────────────────────
export async function updateCampaignVideos(
  claimId: number,
  uploadedVideos: number
): Promise<{ error?: string }> {
  const { supabase } = await requireInternal();

  if (uploadedVideos < 0) return { error: "Jumlah video tidak valid" };

  const { error } = await supabase
    .from("claims")
    .update({
      campaign_uploaded_videos: uploadedVideos,
      last_activity_at: new Date().toISOString(),
    })
    .eq("claim_id", claimId);

  if (error) return { error: "Gagal update jumlah video." };

  revalidatePath(`/leads/${claimId}`);
  return {};
}

// ── Hapus pipeline klaim (internal only) ─────────────────────────────────
export async function deleteClaim(claimId: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ambil path proof files sebelum delete (untuk hapus dari storage)
  const { data: proofFiles } = await supabase
    .from("proof_files")
    .select("file_url")
    .eq("claim_id", claimId);
  const storagePaths = (proofFiles ?? []).map((f) => f.file_url);

  const { data, error } = await supabase.rpc("delete_claim", {
    p_claim_id: claimId,
    p_user_id:  user.id,
  });

  if (error) return { error: "Gagal menghapus data." };
  if (data?.error) return { error: data.error as string };

  // Hapus file dari storage
  if (storagePaths.length > 0) {
    await supabase.storage.from("proof-files").remove(storagePaths);
  }

  revalidatePath("/leads");
  return {};
}

// ── Sourcing POI mandiri (internal) ───────────────────────────────────────
export async function sourcePoiInternal(
  formData: FormData
): Promise<{ claimId?: number; error?: string }> {
  const { supabase, user } = await requireInternal();

  const poiId = (formData.get("poi_id") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const category = (formData.get("category") as string)?.trim();
  const city = (formData.get("city") as string)?.trim();
  const area = (formData.get("area") as string)?.trim();
  const picName = (formData.get("pic_name") as string)?.trim();
  const waNumber = (formData.get("wa_number") as string)?.trim();
  const picPosition = (formData.get("pic_position") as string)?.trim() || null;
  const aovStr = formData.get("aov") as string;
  const aov = aovStr ? parseFloat(aovStr) : null;
  const isUndersupplied = formData.get("is_undersupplied") === "true";
  const priorityTag = (formData.get("priority_tag") as string)?.trim() || null;
  const sourceCampaign = (formData.get("source_campaign") as string)?.trim() || null;

  if (!poiId || !name || !category || !city || !area) {
    return { error: "Kolom wajib (POI ID, Nama, Kategori, Kota, Area) belum diisi" };
  }
  if (!picName || !waNumber) {
    return { error: "Nama PIC dan Nomor WA wajib diisi" };
  }

  const { data, error } = await supabase.rpc("source_poi_internal", {
    p_poi_id:          poiId,
    p_name:            name,
    p_category:        category,
    p_city:            city,
    p_area:            area,
    p_pic_name:        picName,
    p_wa_number:       waNumber,
    p_user_id:         user.id,
    p_pic_position:    picPosition,
    p_aov:             isNaN(aov as number) ? null : aov,
    p_is_undersupplied: isUndersupplied,
    p_priority_tag:    priorityTag,
    p_source_campaign: sourceCampaign,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/leads");
  return { claimId: data.claim_id as number };
}
