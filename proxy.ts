import { NextRequest, NextResponse } from "next/server";

const ADMIN_REALM = "Climpy Admin";

type AdminCredentials = {
  username: string;
  password: string;
};

function createUnauthorizedResponse(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
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

function parseBasicCredentials(
  authorizationHeader: string | null
): AdminCredentials | null {
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

export function proxy(request: NextRequest): NextResponse {
  const adminUsername = process.env.ADMIN_USERNAME?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    console.error(
      "ADMIN_USERNAME and ADMIN_PASSWORD must be configured before admin routes can be accessed."
    );

    return createMisconfiguredResponse();
  }

  const credentials = parseBasicCredentials(
    request.headers.get("authorization")
  );

  if (
    !credentials ||
    credentials.username !== adminUsername ||
    credentials.password !== adminPassword
  ) {
    return createUnauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
