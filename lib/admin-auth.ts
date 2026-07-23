// Single source of truth for the repo's one admin-authorization
// mechanism — shared secret HTTP Basic Auth against ADMIN_USERNAME /
// ADMIN_PASSWORD. Used by proxy.ts (network-boundary gate for /admin and
// /api/admin) and, redundantly, inside each admin Route Handler itself —
// see app/api/admin/feedback/route.ts. Duplicating the check at the route
// level matters because proxy.ts's matcher is a hand-maintained path list
// with no compile-time link to the route file: a matcher edit or a route
// move could silently drop Proxy coverage without either test suite
// noticing, per Next's own guidance to never rely on Proxy alone.
export const ADMIN_AUTH_REALM = "Climpy Admin";

export type AdminAuthOutcome = "authorized" | "unauthenticated" | "misconfigured";

function parseBasicCredentials(
  authorizationHeader: string | null
): { username: string; password: string } | null {
  if (!authorizationHeader?.startsWith("Basic ")) {
    return null;
  }

  const encodedCredentials = authorizationHeader.slice(6).trim();

  if (!encodedCredentials) {
    return null;
  }

  try {
    const decodedCredentials = Buffer.from(
      encodedCredentials,
      "base64"
    ).toString("utf8");
    const separatorIndex = decodedCredentials.indexOf(":");

    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decodedCredentials.slice(0, separatorIndex),
      password: decodedCredentials.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

// Reads ADMIN_USERNAME / ADMIN_PASSWORD directly at check time (never
// passed in) so every caller always evaluates the current environment,
// matching proxy.ts's original inline behavior.
export function checkAdminBasicAuth(
  authorizationHeader: string | null
): AdminAuthOutcome {
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return "misconfigured";
  }

  const credentials = parseBasicCredentials(authorizationHeader);

  if (
    !credentials ||
    credentials.username !== adminUsername ||
    credentials.password !== adminPassword
  ) {
    return "unauthenticated";
  }

  return "authorized";
}
