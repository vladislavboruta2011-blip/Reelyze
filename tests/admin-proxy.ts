import { NextRequest } from "next/server";

import { config as proxyConfig, proxy } from "../proxy";

const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalAdminPassword = process.env.ADMIN_PASSWORD;

function restoreEnvironment(): void {
  if (originalAdminUsername === undefined) {
    delete process.env.ADMIN_USERNAME;
  } else {
    process.env.ADMIN_USERNAME = originalAdminUsername;
  }

  if (originalAdminPassword === undefined) {
    delete process.env.ADMIN_PASSWORD;
  } else {
    process.env.ADMIN_PASSWORD = originalAdminPassword;
  }
}

function createRequest(authorization?: string): NextRequest {
  const headers = new Headers();

  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }

  return new NextRequest("http://localhost/admin/feedback", {
    headers,
  });
}

function createBasicAuthorization(
  username: string,
  password: string
): string {
  const encodedCredentials = Buffer.from(
    `${username}:${password}`,
    "utf8"
  ).toString("base64");

  return `Basic ${encodedCredentials}`;
}

function expectStatus(
  response: Response,
  expectedStatus: number,
  message: string
): void {
  if (response.status !== expectedStatus) {
    throw new Error(
      `${message} Expected ${expectedStatus}, received ${response.status}.`
    );
  }
}

function main(): void {
  try {
    const expectedMatchers = [
      "/admin/:path*",
      "/api/admin/:path*",
    ];

    if (
      JSON.stringify(proxyConfig.matcher) !==
      JSON.stringify(expectedMatchers)
    ) {
      throw new Error("Proxy matcher does not protect both admin routes.");
    }

    console.log("PASS — protects admin page and admin API routes");

    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;

    {
      const response = proxy(createRequest());

      expectStatus(
        response,
        503,
        "Missing admin configuration should fail closed."
      );

      if (response.headers.get("cache-control") !== "no-store") {
        throw new Error(
          "Misconfigured admin response should disable caching."
        );
      }

      console.log("PASS — fails closed when admin access is not configured");
    }

    process.env.ADMIN_USERNAME = "admin-test";
    process.env.ADMIN_PASSWORD = "correct:test-password";

    {
      const response = proxy(createRequest());

      expectStatus(
        response,
        401,
        "Request without authorization should be rejected."
      );

      const challenge = response.headers.get("www-authenticate");

      if (!challenge?.startsWith('Basic realm="Reelyze Admin"')) {
        throw new Error(
          "Unauthorized response should include a Basic Auth challenge."
        );
      }

      console.log("PASS — rejects requests without authorization");
    }

    {
      const response = proxy(
        createRequest(
          createBasicAuthorization(
            "admin-test",
            "wrong-password"
          )
        )
      );

      expectStatus(
        response,
        401,
        "Request with incorrect credentials should be rejected."
      );

      console.log("PASS — rejects incorrect admin credentials");
    }

    {
      const response = proxy(
        createRequest(
          createBasicAuthorization(
            "admin-test",
            "correct:test-password"
          )
        )
      );

      expectStatus(
        response,
        200,
        "Request with correct credentials should continue."
      );

      console.log("PASS — accepts correct admin credentials");
    }

    console.log("\nAdmin proxy tests: all passed");
  } finally {
    restoreEnvironment();
  }
}

try {
  main();
} catch (error: unknown) {
  restoreEnvironment();

  const message =
    error instanceof Error ? error.message : String(error);

  console.error(`FAIL — ${message}`);
  process.exitCode = 1;
}
