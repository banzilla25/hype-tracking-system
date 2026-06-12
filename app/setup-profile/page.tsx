import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SetupProfileForm from "@/components/setup-profile-form";

export default async function SetupProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Kalau profil sudah ada, tidak perlu setup lagi
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .single();

  if (profile) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">Selamat datang!</h1>
          <p className="mt-1 text-sm text-gray-500">
            Isi nama panggilanmu untuk melanjutkan
          </p>
        </div>
        <SetupProfileForm />
        <p className="mt-5 text-center text-xs text-gray-400">{user.email}</p>
      </div>
    </main>
  );
}
