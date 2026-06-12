"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ── Claim POI dari pool ────────────────────────────────────────────────────
export async function claimPoi(poiId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("claim_poi", {
    p_poi_id: poiId,
    p_user_id: user.id,
  });

  if (error) return { error: "Terjadi kesalahan. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/pool");
  revalidatePath("/tasks");
  return {};
}

// ── Transisi status klaim (Fase 1 + 2) ───────────────────────────────────
export async function transitionStatus(
  claimId: number,
  toStatus: string,
  opts: {
    note?: string;
    failReason?: string;
    picName?: string;
    waNumber?: string;
    picPosition?: string;
  } = {}
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("transition_claim_status", {
    p_claim_id:     claimId,
    p_to_status:    toStatus,
    p_user_id:      user.id,
    p_note:         opts.note ?? null,
    p_fail_reason:  opts.failReason ?? null,
    p_pic_name:     opts.picName ?? null,
    p_wa_number:    opts.waNumber ?? null,
    p_pic_position: opts.picPosition ?? null,
  });

  if (error) return { error: "Terjadi kesalahan sistem. Coba lagi." };
  if (data?.error) return { error: data.error as string };

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${claimId}`);
  if (toStatus === "gagal") revalidatePath("/pool");
  return {};
}

// ── Update info kontak ────────────────────────────────────────────────────
export async function updateContactInfo(
  claimId: number,
  picName: string,
  waNumber: string,
  picPosition: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!picName.trim()) return { error: "Nama PIC wajib diisi" };
  if (!waNumber.trim()) return { error: "Nomor WhatsApp wajib diisi" };

  const { error } = await supabase
    .from("claims")
    .update({
      pic_name:         picName.trim(),
      wa_number:        waNumber.trim(),
      pic_position:     picPosition?.trim() || null,
      last_activity_at: new Date().toISOString(),
    })
    .eq("claim_id", claimId)
    .eq("user_id", user.id);

  if (error) return { error: "Gagal menyimpan kontak. Coba lagi." };

  revalidatePath(`/tasks/${claimId}`);
  return {};
}

// ── Upload file bukti ─────────────────────────────────────────────────────
export async function uploadProofFile(
  claimId: number,
  formData: FormData
): Promise<{ fileId?: number; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "File tidak ditemukan" };
  if (file.size > 10 * 1024 * 1024) return { error: "Ukuran file maks 10 MB" };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
    return { error: "Format tidak didukung. Gunakan JPG, PNG, atau WebP." };
  }

  const storagePath = `${claimId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("proof-files")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return { error: "Gagal upload. Coba lagi." };

  const { data: inserted, error: insertError } = await supabase
    .from("proof_files")
    .insert({ claim_id: claimId, file_type: "proof_chat", file_url: storagePath })
    .select("file_id")
    .single();

  if (insertError) {
    await supabase.storage.from("proof-files").remove([storagePath]);
    return { error: "Gagal menyimpan referensi file." };
  }

  // Touch last_activity_at agar timer 7-hari auto-release reset
  await supabase
    .from("claims")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("claim_id", claimId)
    .eq("user_id", user.id);

  revalidatePath(`/tasks/${claimId}`);
  return { fileId: inserted.file_id };
}

// ── Hapus file bukti ──────────────────────────────────────────────────────
export async function deleteProofFile(
  fileId: number,
  storagePath: string,
  claimId: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error: dbError } = await supabase
    .from("proof_files")
    .delete()
    .eq("file_id", fileId);

  if (dbError) return { error: "Gagal menghapus file." };

  await supabase.storage.from("proof-files").remove([storagePath]);

  revalidatePath(`/tasks/${claimId}`);
  return {};
}
