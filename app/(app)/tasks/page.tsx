import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TasksPageClient from "@/components/tasks-page-client";

const TERMINAL_STATUSES = [
  "gagal",
  "poi_mati",
  "declined",
  "campaign_selesai",
  "repeat_campaign",
];

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cek-on-load: lepas klaim yang tidak aktif > 7 hari
  await supabase.rpc("auto_release_stale_claims");

  const { data: claims } = await supabase
    .from("claims")
    .select(
      `
      claim_id,
      claim_status,
      pic_name,
      wa_number,
      last_activity_at,
      poi_id,
      pois (
        name,
        category,
        area,
        city,
        is_undersupplied
      )
    `
    )
    .eq("user_id", user.id)
    .not("claim_status", "in", `(${TERMINAL_STATUSES.join(",")})`)
    .order("last_activity_at", { ascending: false });

  return <TasksPageClient claims={claims ?? []} />;
}
