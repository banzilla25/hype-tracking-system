import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddApproachedPoiForm from "@/components/add-approached-poi-form";

export default async function AddApproachedPoiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "freelancer") redirect("/leads");

  return (
    <div className="flex flex-col h-[100dvh] max-w-lg mx-auto">
      <div className="sticky top-0 bg-gray-50 z-10 px-4 pt-4 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            href="/tasks"
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500"
          >
            ←
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">Sudah Approach POI?</h1>
            <p className="text-xs text-gray-500">Input POI yang sudah kamu hubungi</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <AddApproachedPoiForm />
      </div>
    </div>
  );
}
