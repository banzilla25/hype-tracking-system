import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // PENTING: refresh session harus pertama, sebelum logika apapun
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── OAuth callback — selalu biarkan lewat ──────────────────────
  if (path.startsWith("/auth/callback")) return supabaseResponse;

  // ── Halaman login ──────────────────────────────────────────────
  if (path === "/login") {
    // User sudah login → redirect ke root (root page akan routing ke tempat yang benar)
    if (user) return NextResponse.redirect(new URL("/", request.url));
    return supabaseResponse;
  }

  // ── Semua route lain wajib login ───────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── /setup-profile & /pending tidak perlu cek profil ──────────
  if (path.startsWith("/setup-profile") || path.startsWith("/pending")) {
    return supabaseResponse;
  }

  // ── Route terlindungi: cek status profil ──────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/setup-profile", request.url));
  }

  if (profile.account_status === "pending") {
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  if (profile.account_status === "inactive") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Route khusus internal ──────────────────────────────────────
  if (
    (path.startsWith("/approve") || path.startsWith("/import") ||
     path.startsWith("/leads") || path.startsWith("/dashboard")) &&
    profile.role !== "internal"
  ) {
    return NextResponse.redirect(new URL("/pool", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
