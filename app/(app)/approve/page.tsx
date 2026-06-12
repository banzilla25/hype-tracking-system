import { createClient } from "@/lib/supabase/server";
import { ApproveButtons } from "@/components/approve-account-buttons";

export default async function ApprovePage() {
  const supabase = await createClient();

  const { data: pending } = await supabase
    .from("profiles")
    .select("id, nickname, created_at")
    .eq("account_status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Approve Akun</h1>
        <p className="text-sm text-gray-500 mt-1">
          {pending?.length ?? 0} akun menunggu persetujuan
        </p>
      </div>

      {!pending?.length ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700">Semua beres!</p>
          <p className="text-xs text-gray-400 mt-1">
            Tidak ada akun yang menunggu persetujuan
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((account) => (
            <div
              key={account.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-semibold text-sm">
                      {account.nickname.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {account.nickname}
                    </p>
                    <p className="text-xs text-gray-400">
                      Daftar{" "}
                      {new Date(account.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <ApproveButtons userId={account.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
