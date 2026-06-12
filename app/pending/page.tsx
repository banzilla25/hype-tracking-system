import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/actions/auth";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, account_status")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/setup-profile");
  if (profile.account_status === "active") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClockIcon />
        </div>

        <h1 className="text-xl font-bold text-gray-900">Menunggu Persetujuan</h1>
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">
          Hei <span className="font-semibold text-gray-700">{profile.nickname}</span>,
          akunmu sedang dalam proses persetujuan oleh tim internal. Kamu akan bisa
          mengakses sistem setelah di-approve.
        </p>

        <div className="mt-5 px-4 py-3 bg-blue-50 rounded-xl">
          <p className="text-xs text-blue-600">
            Hubungi tim internal jika membutuhkan akses segera.
          </p>
        </div>

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Logout
          </button>
        </form>
      </div>
    </main>
  );
}

function ClockIcon() {
  return (
    <svg
      className="w-7 h-7 text-yellow-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
