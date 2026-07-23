import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { checkAdminBasicAuth, ADMIN_AUTH_REALM } from "./lib/admin-auth";
import { getSupabasePublicKey } from "./lib/supabase-config";

function createUnauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
    },
  });
}

function createMisconfiguredResponse(): NextResponse {
  return new NextResponse("Admin access is not configured.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Unchanged behavior from before Supabase session refresh was added below —
// still governs only /admin and /api/admin, same checks, same responses.
// The check itself lives in lib/admin-auth.ts, shared with the redundant
// in-route check in app/api/admin/feedback/route.ts.
function handleAdminBasicAuth(request: NextRequest): NextResponse {
  const outcome = checkAdminBasicAuth(request.headers.get("authorization"));

  if (outcome === "misconfigured") {
    console.error(
      "ADMIN_USERNAME and ADMIN_PASSWORD must be configured before admin routes can be accessed."
    );

    return createMisconfiguredResponse();
  }

  if (outcome === "unauthenticated") {
    return createUnauthorizedResponse();
  }

  return NextResponse.next();
}

// Keeps the Supabase session cookie fresh on every non-admin request so
// createSupabaseServerClient() (lib/supabase/server.ts) always sees a valid
// session in Server Components and Route Handlers.
//
// Uses getClaims(), not getSession() — getSession() only reads the
// (possibly forged/stale) cookie without verifying it, so it must never be
// treated as proof of identity. getClaims() is what @supabase/ssr@0.12.3's
// own JSDoc recommends ("Prefer this method over getUser()"): it internally
// calls getSession() first — which still performs the refresh-token
// rotation this function exists for — then verifies the JWT locally via the
// project's cached JWKS when asymmetric signing keys are configured
// (no network round trip), or transparently falls back to the same
// server-verified getUser() network call for projects still on a symmetric
// signing secret. Either way the identity check is server-verified, never
// just a locally-decoded trust-the-cookie read.
async function refreshSupabaseSession(
  request: NextRequest
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = getSupabasePublicKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    // Auth isn't configured in this environment yet — fail open rather
    // than block every route in the app on a missing env var.
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      // The installed @supabase/ssr version's setAll passes a second
      // `headers` argument — Cache-Control/Expires/Pragma values that MUST
      // be copied onto the response whenever cookies are (re)written, so a
      // CDN/reverse proxy in front of this app (Vercel Edge, etc.) never
      // caches a response carrying one user's refreshed session cookie and
      // serves it back to a different user.
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );

        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value)
        );
      },
    },
  });

  try {
    // Result intentionally discarded — only the refresh-token rotation and
    // cookie write (both handled internally, above, via setAll) matter
    // here. getClaims()/getUser() can both rethrow a non-AuthError (e.g. a
    // transient network failure talking to Supabase, or a malformed
    // session cookie) instead of returning a clean { error } result — and
    // since this function runs on almost every route in the app, letting
    // that escape would take down every page for every visitor, including
    // fully anonymous ones. Fail open instead.
    await supabase.auth.getClaims();
  } catch (error) {
    console.error("Supabase session refresh failed", error);
  }

  return response;
}

export async function proxy(
  request: NextRequest
): Promise<NextResponse> {
  const path = request.nextUrl.pathname;

  // Admin routes keep their original, self-contained Basic Auth check —
  // it never touches Supabase and must never be affected by session
  // refresh failing, being slow, or being misconfigured.
  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    return handleAdminBasicAuth(request);
  }

  return refreshSupabaseSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
