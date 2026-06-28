import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

function createJsonResponse(
  body: Record<string, unknown>,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function GET(): Promise<Response> {
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
