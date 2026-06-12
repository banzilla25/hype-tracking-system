"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notifId: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("notification_id", notifId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Tidak terautentikasi" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (error) return { error: error.message };
  revalidatePath("/notifications");
  return {};
}
