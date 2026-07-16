import { NextResponse } from "next/server";
import { sanitizeNextPath } from "@/lib/auth-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// This route is the one place in the app that freshly establishes a
// session (exchangeCodeForSession writes the initial Set-Cookie headers).
// Every response it returns — success or error — must carry this so a
// CDN/reverse proxy in front of the app never caches a response containing
// a just-issued session cookie and serves it to a different visitor.
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

function redirectNoStore(url: URL): NextResponse {
  return NextResponse.redirect(url, { headers: NO_STORE_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"));

  if (!code) {
    return redirectNoStore(
      new URL("/login?error=missing_code", url.origin)
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "Failed to exchange OAuth code for a session",
        error
      );

      return redirectNoStore(
        new URL("/login?error=auth_failed", url.origin)
      );
    }
  } catch (error) {
    console.error("OAuth callback failed unexpectedly", error);

    return redirectNoStore(
      new URL("/login?error=auth_failed", url.origin)
    );
  }

  return redirectNoStore(new URL(next, url.origin));
}
