import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NotificationsClient from "@/components/notifications-client";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("notification_id, type, message, is_read, created_at, claim_id, poi_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return <NotificationsClient notifications={notifications ?? []} />;
}
