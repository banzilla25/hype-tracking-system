import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LeadsPageClient, { type Lead } from "@/components/leads-page-client";

const FASE2_STATUSES = [
  "submitted",
  "validasi_nomor",
  "nomor_invalid",
  "fiksasi_kerjasama",
  "disetujui_diklaim",
  "koordinasi_kreator",
  "campaign_jalan",
  "campaign_selesai",
];

export default async function LeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: leads } = await supabase
    .from("claims")
    .select(
      `
      claim_id,
      claim_status,
      submitted_at,
      last_activity_at,
      pic_name,
      wa_number,
      poi_id,
      pois (
        name,
        category,
        area,
        city,
        source
      ),
      profiles (
        nickname
      )
    `
    )
    .in("claim_status", FASE2_STATUSES)
    .order("last_activity_at", { ascending: false });

  return <LeadsPageClient leads={(leads ?? []) as unknown as Lead[]} />;
}
