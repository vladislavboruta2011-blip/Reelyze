import { POST } from "../app/api/feedback/route";

function createRequest(
  body: unknown,
  contentType = "application/json"
): Request {
  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: {
      "content-type": contentType,
    },
    body:
      typeof body === "string"
        ? body
        : JSON.stringify(body),
  });
}

async function expectJson(
  response: Response
): Promise<Record<string, unknown>> {
  const json = (await response.json()) as unknown;

  if (
    typeof json !== "object" ||
    json === null ||
    Array.isArray(json)
  ) {
    throw new Error("Expected JSON object response.");
  }

  return json as Record<string, unknown>;
}

function createValidFeedback(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    rating: "helpful",
    reason: "Useful fixes",
    text: null,
    title: "Phone battery setting",
    script:
      "Your phone battery dies faster because of one hidden setting. Many apps keep running in the background.",
    overallScore: 80,
    hookScore: 85,
    retentionRisk: 30,
    mainTakeaway: "The script has a clear problem and payoff.",
    currentPath: "/results",
    ...overrides,
  };
}

async function main(): Promise<void> {
  {
    const response = await POST(
      createRequest(createValidFeedback())
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error("Valid helpful feedback should be accepted.");
    }

    console.log("PASS — accepts valid helpful feedback");
  }

  {
    const response = await POST(
      createRequest(
        createValidFeedback({
          rating: "unhelpful",
          reason: "Wrong score",
          text: "The score felt too high.",
        })
      )
    );
    const json = await expectJson(response);

    if (response.status !== 200 || json.status !== "ok") {
      throw new Error("Valid unhelpful feedback should be accepted.");
    }

    console.log("PASS — accepts valid unhelpful feedback");
  }

  {
    const response = await POST(
      createRequest(createValidFeedback({ rating: "dislike" }))
    );
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Invalid rating should be rejected.");
    }

    console.log("PASS — rejects invalid rating");
  }

  {
    const response = await POST(createRequest("{bad json"));
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Malformed JSON should be rejected.");
    }

    console.log("PASS — rejects malformed JSON");
  }

  {
    const response = await POST(
      createRequest(createValidFeedback(), "text/plain")
    );
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Non-JSON content type should be rejected.");
    }

    console.log("PASS — rejects non-JSON content type");
  }

  {
    const response = await POST(
      createRequest(createValidFeedback({ script: "x".repeat(1001) }))
    );
    const json = await expectJson(response);

    if (response.status !== 400 || json.status !== "error") {
      throw new Error("Oversized script should be rejected.");
    }

    console.log("PASS — rejects oversized script");
  }

  console.log("\nFeedback API tests: all passed");
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown test failure.";

  console.error(`\nFeedback API tests failed: ${message}`);
  process.exitCode = 1;
});
