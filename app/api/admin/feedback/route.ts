import { ADMIN_AUTH_REALM, checkAdminBasicAuth } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
// Route Handlers are statically evaluated by default unless they opt out —
// this one must never be cached (per-request auth check + private data),
// so every response below also carries an explicit Cache-Control header
// as a second, response-level guarantee.
export const dynamic = "force-dynamic";

function createJsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders?: Record<string, string>
): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// Redundant, in-route check on top of proxy.ts's network-boundary Basic
// Auth gate for /api/admin/:path* — see lib/admin-auth.ts's module comment
// for why relying on the proxy matcher alone isn't sufficient. Must run,
// and fail closed, before any Supabase query using the service-role
// client (which bypasses RLS entirely).
export async function GET(request: Request): Promise<Response> {
  const outcome = checkAdminBasicAuth(request.headers.get("authorization"));

  if (outcome === "misconfigured") {
    console.error(
      "ADMIN_USERNAME and ADMIN_PASSWORD must be configured before admin routes can be accessed."
    );

    return createJsonResponse(
      {
        status: "error",
        reason: "Admin access is not configured.",
      },
      503
    );
  }

  if (outcome === "unauthenticated") {
    return createJsonResponse(
      {
        status: "error",
        reason: "Authentication required.",
      },
      401,
      {
        "WWW-Authenticate": `Basic realm="${ADMIN_AUTH_REALM}", charset="UTF-8"`,
      }
    );
  }

  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id,rating,reason,text,title,script_preview,overall_score,hook_score,retention_risk,main_takeaway,current_path,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to load feedback records", error);

    return createJsonResponse(
      {
        status: "error",
        reason: "Feedback records could not be loaded.",
      },
      500
    );
  }

  return createJsonResponse(
    {
      status: "ok",
      feedback: data,
    },
    200
  );
}
