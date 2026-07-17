import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/dashboard-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { rpc: (fn: string, ...args: any[]) => Promise<{ data: any; error: any }> };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Cast ke AnySupabase karena fungsi RPC baru belum ada di generated types.
  // Semua query pakai aggregate — tidak ada baris yang dikirim ke client,
  // sehingga tidak kena limit 1000 baris Supabase berapapun jumlah data.
  const db = supabase as unknown as AnySupabase;

  // ── POI counts per status (untuk funnel) ──────────────────────────────────
  const { data: statusRows } = await db.rpc("get_poi_status_counts");
  const statusCounts = ((statusRows ?? []) as { status: string; cnt: number }[])
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = Number(r.cnt);
      return acc;
    }, {});

  // ── Total POI (semua status) ───────────────────────────────────────────────
  const totalPoi = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  // ── Ringkasan klaim ───────────────────────────────────────────────────────
  const { data: summary } = await db.rpc("get_claims_summary");
  const s = (summary ?? {}) as Record<string, number>;
  const totalDikunjungi   = Number(s.total            ?? 0);
  const totalSubmitted    = Number(s.submitted        ?? 0);
  const totalSelesai      = Number(s.campaign_selesai ?? 0);

  // ── Statistik per freelancer ──────────────────────────────────────────────
  const { data: flRows } = await db.rpc("get_freelancer_stats");
  const freelancers = ((flRows ?? []) as {
    user_id: string; nickname: string;
    total: number; submitted: number; gagal: number;
    auto_release: number; campaign_selesai: number; fee_aman: number;
  }[]).map((r) => ({
    user_id:         r.user_id,
    nickname:        r.nickname,
    total:           Number(r.total),
    submitted:       Number(r.submitted),
    gagal:           Number(r.gagal),
    autoRelease:     Number(r.auto_release),
    campaignSelesai: Number(r.campaign_selesai),
    feeAman:         Number(r.fee_aman),
  }));

  return (
    <DashboardClient
      statusCounts={statusCounts}
      totalPoi={totalPoi}
      totalDikunjungi={totalDikunjungi}
      totalSubmitted={totalSubmitted}
      totalSelesai={totalSelesai}
      freelancers={freelancers}
    />
  );
}
