// app/api/analyze/route.ts
// This route is reserved for future full-script AI analysis.
// Hook improvement is handled by /api/improve.

export async function POST(): Promise<Response> {
  return Response.json({ status: "ok", message: "Use /api/improve for hook analysis." });
}