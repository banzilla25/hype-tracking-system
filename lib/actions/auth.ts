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

export async function createProfile(
  formData: FormData
): Promise<{ error: string } | undefined> {
  const nickname = (formData.get("nickname") as string)?.trim();
  if (!nickname) return { error: "Nama panggilan wajib diisi" };
  if (nickname.length < 2) return { error: "Nama minimal 2 karakter" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Kalau profil sudah ada, langsung redirect
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (existing) redirect("/");

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    nickname,
    role: "freelancer",
    account_status: "pending",
  });

  if (error) return { error: "Gagal menyimpan profil. Coba lagi." };

  redirect("/pending");
}

export async function approveAccount(userId: string): Promise<void> {
  const { supabase } = await requireInternal();

  await supabase
    .from("profiles")
    .update({ account_status: "active" })
    .eq("id", userId);

  revalidatePath("/approve");
}

export async function rejectAccount(userId: string): Promise<void> {
  const { supabase } = await requireInternal();

  await supabase
    .from("profiles")
    .update({ account_status: "inactive" })
    .eq("id", userId);

  revalidatePath("/approve");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
