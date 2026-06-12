import { createClient } from "@supabase/supabase-js";

// Admin client — bypasses RLS. Hanya dipakai server-side untuk operasi sistem.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
