import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Root page: redirect ke halaman yang tepat berdasarkan status akun
export default async function Root() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/setup-profile");
  if (profile.account_status === "pending") redirect("/pending");
  if (profile.account_status === "inactive") redirect("/login");

  // Akun aktif → routing berdasarkan role
  if (profile.role === "internal") redirect("/approve");
  redirect("/pool");
}
