"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function updateNickname(
  nickname: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clean = nickname.trim();
  if (!clean) return { error: "Nama panggilan tidak boleh kosong" };
  if (clean.length > 40) return { error: "Nama panggilan maksimal 40 karakter" };

  const { error } = await supabase
    .from("profiles")
    .update({ nickname: clean })
    .eq("id", user.id);

  if (error) return { error: "Gagal menyimpan nama. Coba lagi." };

  revalidatePath("/profile");
  return {};
}
