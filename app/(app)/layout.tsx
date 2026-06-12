import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InternalSidebar from "@/components/nav/internal-sidebar";
import FreelancerNav from "@/components/nav/freelancer-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, role, account_status")
    .eq("id", user.id)
    .single();

  // Middleware sudah handle redirect ini, tapi ini fallback keamanan
  if (!profile || profile.account_status !== "active") redirect("/");

  // Hitung notifikasi belum dibaca
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  if (profile.role === "internal") {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <InternalSidebar nickname={profile.nickname} unreadCount={unreadCount ?? 0} />
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <main className="flex-1 overflow-auto pb-16">{children}</main>
      <FreelancerNav unreadCount={unreadCount ?? 0} />
    </div>
  );
}
