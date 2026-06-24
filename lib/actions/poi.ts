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

  const { data: claim } = await supabase
    .from("claims")
    .select("claim_status, poi_id")
    .eq("claim_id", claimId)
    .eq("user_id", user.id)
    .single();
  if (!claim) return { error: "Klaim tidak ditemukan" };

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  await supabase.from("status_history").insert({
    poi_id:          claim.poi_id,
    claim_id:        claimId,
    from_status:     claim.claim_status,
    to_status:       claim.claim_status,
    changed_by:      user.id,
    changed_by_role: profile?.role ?? "freelancer",
    note:            `Update kontak: PIC "${picName.trim()}", WA "${waNumber.trim()}"`,
  });

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

  const { count: existingFileCount } = await supabase
    .from("proof_files")
    .select("file_id", { count: "exact", head: true })
    .eq("claim_id", claimId);
  if ((existingFileCount ?? 0) >= 10) {
    return { error: "Maksimal 10 file bukti per klaim. Hapus salah satu dulu kalau perlu upload lagi." };
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

// ── Tambah POI ke Pool ────────────────────────────────────────────────────
// Internal → POI langsung available (tidak di-claim)
// Freelancer → POI di-claim otomatis oleh si penginput (in_progress)
export async function addPoiToPool(
  formData: FormData
): Promise<{ error?: string; warning?: string; poiId?: string; claimId?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();
  if (!profile) return { error: "Profil tidak ditemukan." };

  const name      = (formData.get("name") as string)?.trim();
  const category  = (formData.get("category") as string)?.trim();
  const city      = (formData.get("city") as string)?.trim();
  const area      = (formData.get("area") as string)?.trim();
  const aovRaw    = formData.get("aov") as string;
  const aov       = aovRaw ? parseInt(aovRaw, 10) : null;
  const priorityTag = (formData.get("priority_tag") as string)?.trim() || null;
  const force     = formData.get("force") === "true";

  if (!name || !category || !city || !area)
    return { error: "Nama, kategori, kota, dan area wajib diisi." };

  // Cek duplikat
  if (!force) {
    const { data: similar } = await supabase
      .from("pois")
      .select("name, area, city")
      .ilike("name", `%${name}%`)
      .limit(3);
    if (similar && similar.length > 0) {
      const list = similar.map((p) => `${p.name} (${p.area})`).join(", ");
      return { warning: `POI dengan nama serupa sudah ada: ${list}` };
    }
  }

  const isInternal = profile.role === "internal";

  // Cek limit slot untuk freelancer
  if (!isInternal) {
    const TERMINAL = ["gagal", "poi_mati", "declined", "campaign_selesai", "repeat_campaign"];
    const { data: slotData } = await supabase
      .from("claims")
      .select("claim_status")
      .eq("user_id", user.id);
    const activeCount = (slotData ?? []).filter((c) => !TERMINAL.includes(c.claim_status)).length;
    if (activeCount >= 10)
      return { error: "Slot penuh. Selesaikan beberapa POI aktif dulu." };
  }

  const poiId = `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const poiStatus = isInternal ? "available" : "in_progress";

  const { error: poiErr } = await supabase.from("pois").insert({
    poi_id:          poiId,
    name,
    category,
    city,
    area,
    aov:             aov && !isNaN(aov) ? aov : null,
    priority_tag:    priorityTag,
    source:          isInternal ? "internal" : "freelancer",
    status:          poiStatus,
    current_claim_id: null,
    approval_status: isInternal ? "approved" : "pending",
  });
  if (poiErr) return { error: "Gagal menyimpan POI. Coba lagi." };

  if (isInternal) {
    revalidatePath("/pool");
    return { poiId };
  }

  // Freelancer: buat claim otomatis
  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .insert({
      poi_id:          poiId,
      user_id:         user.id,
      claim_status:    "in_progress",
      last_activity_at: new Date().toISOString(),
    })
    .select("claim_id")
    .single();

  if (claimErr || !claim) {
    await supabase.from("pois").delete().eq("poi_id", poiId);
    return { error: "Gagal membuat klaim. Coba lagi." };
  }

  await supabase.from("pois").update({ current_claim_id: claim.claim_id }).eq("poi_id", poiId);

  await supabase.from("status_history").insert({
    poi_id:          poiId,
    claim_id:        claim.claim_id,
    from_status:     null,
    to_status:       "in_progress",
    changed_by:      user.id,
    changed_by_role: "freelancer",
    note:            "POI ditambahkan oleh freelancer ke pipeline",
  });

  // Notif ke semua internal
  try {
    const { data: internals } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "internal");
    if (internals && internals.length > 0) {
      await supabase.from("notifications").insert(
        internals.map((u) => ({
          user_id:  u.id,
          claim_id: claim.claim_id,
          poi_id:   poiId,
          type:     "new_poi_freelancer",
          message:  `${profile.nickname} menambahkan POI baru: ${name} (${area}, ${city})`,
        }))
      );
    }
  } catch { /* notif gagal tidak block flow */ }

  revalidatePath("/tasks");
  revalidatePath("/pool");
  return { claimId: claim.claim_id };
}

// ── Tambah POI yang sudah di-approach freelancer ──────────────────────────
export async function addApproachedPoi(
  formData: FormData
): Promise<{ error?: string; warning?: string; claimId?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "freelancer")
    return { error: "Fitur ini hanya untuk freelancer." };

  const name          = (formData.get("name") as string)?.trim();
  const category      = (formData.get("category") as string)?.trim();
  const city          = (formData.get("city") as string)?.trim();
  const area          = (formData.get("area") as string)?.trim();
  const picName       = (formData.get("pic_name") as string)?.trim();
  const waNumber      = (formData.get("wa_number") as string)?.trim();
  const picPosition   = (formData.get("pic_position") as string)?.trim() || null;
  const initialStatus = (formData.get("initial_status") as string) ?? "in_progress";
  const note          = (formData.get("note") as string)?.trim() || null;
  const aovRaw        = formData.get("aov") as string;
  const aov           = aovRaw ? parseInt(aovRaw, 10) : null;
  const priorityTag   = (formData.get("priority_tag") as string)?.trim() || null;
  const force         = formData.get("force") === "true";

  if (!name || !category || !city || !area || !picName || !waNumber)
    return { error: "Nama, kategori, kota, area, nama PIC, dan nomor WA wajib diisi." };

  if (!["in_progress", "semi_dealing"].includes(initialStatus))
    return { error: "Status awal tidak valid." };

  // Cek limit slot
  const TERMINAL = ["gagal", "poi_mati", "declined", "campaign_selesai", "repeat_campaign"];
  const { data: slotData } = await supabase
    .from("claims")
    .select("claim_status")
    .eq("user_id", user.id);
  const activeCount = (slotData ?? []).filter((c) => !TERMINAL.includes(c.claim_status)).length;
  if (activeCount >= 10)
    return { error: "Slot penuh. Selesaikan beberapa POI aktif dulu." };

  // Cek duplikat
  if (!force) {
    const { data: similar } = await supabase
      .from("pois")
      .select("name, area, city")
      .ilike("name", `%${name}%`)
      .limit(3);
    if (similar && similar.length > 0) {
      const list = similar.map((p) => `${p.name} (${p.area})`).join(", ");
      return { warning: `POI dengan nama serupa sudah ada: ${list}` };
    }
  }

  const poiId = `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const { error: poiErr } = await supabase.from("pois").insert({
    poi_id:          poiId,
    name,
    category,
    city,
    area,
    aov:             aov && !isNaN(aov) ? aov : null,
    priority_tag:    priorityTag,
    source:          "freelancer",
    status:          initialStatus,
    current_claim_id: null,
    approval_status: "pending",
  });
  if (poiErr) return { error: "Gagal menyimpan POI. Coba lagi." };

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .insert({
      poi_id:          poiId,
      user_id:         user.id,
      claim_status:    initialStatus,
      pic_name:        picName,
      wa_number:       waNumber,
      pic_position:    picPosition,
      last_activity_at: new Date().toISOString(),
    })
    .select("claim_id")
    .single();

  if (claimErr || !claim) {
    await supabase.from("pois").delete().eq("poi_id", poiId);
    return { error: "Gagal membuat klaim. Coba lagi." };
  }

  await supabase.from("pois").update({ current_claim_id: claim.claim_id }).eq("poi_id", poiId);

  await supabase.from("status_history").insert({
    poi_id:          poiId,
    claim_id:        claim.claim_id,
    from_status:     null,
    to_status:       initialStatus,
    changed_by:      user.id,
    changed_by_role: "freelancer",
    note:            note ?? "POI diinput langsung oleh freelancer yang sudah approach",
  });

  // Notif ke internal
  try {
    const { data: internals } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "internal");
    if (internals && internals.length > 0) {
      const statusLabel = initialStatus === "semi_dealing" ? "sudah semi-deal" : "sedang diproses";
      await supabase.from("notifications").insert(
        internals.map((u) => ({
          user_id:  u.id,
          claim_id: claim.claim_id,
          poi_id:   poiId,
          type:     "approached_poi",
          message:  `${profile.nickname} input POI ${statusLabel}: ${name} (${area}, ${city}). PIC: ${picName} — ${waNumber}`,
        }))
      );
    }
  } catch { /* notif gagal tidak block flow */ }

  revalidatePath("/tasks");
  return { claimId: claim.claim_id };
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
