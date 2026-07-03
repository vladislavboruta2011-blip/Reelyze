import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FeedbackRecord = {
  id: number;
  rating: string;
  reason: string | null;
  text: string | null;
  title: string;
  script_preview: string;
  overall_score: number | null;
  hook_score: number | null;
  retention_risk: number | null;
  main_takeaway: string | null;
  current_path: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminFeedbackPage() {
  const { data, error } = await supabase
    .from("feedback")
    .select(
      "id,rating,reason,text,title,script_preview,overall_score,hook_score,retention_risk,main_takeaway,current_path,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const feedback = (data ?? []) as FeedbackRecord[];
  const helpfulCount = feedback.filter((item) => item.rating === "helpful").length;
  const unhelpfulCount = feedback.filter((item) => item.rating === "unhelpful").length;

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-white">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#EF4444]">
            Reelyze Admin
          </p>
          <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.03em]">
            Feedback
          </h1>
          <p className="mt-2 max-w-[680px] text-[14px] leading-6 text-[#777A85]">
            Latest feedback submitted from the Results Page. Use this to spot
            wrong scores, weak suggestions, and common user objections.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-[16px] border border-[#EF4444]/30 bg-[#EF4444]/10 p-4 text-[14px] text-[#FCA5A5]">
            Feedback could not be loaded.
          </div>
        )}

        {!error && feedback.length > 0 && (
          <section className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[16px] border border-[#24242A] bg-[#0B0B0F] p-4">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#777A85]">
                Total
              </p>
              <p className="mt-2 text-[26px] font-semibold text-white">
                {feedback.length}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#24242A] bg-[#0B0B0F] p-4">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#777A85]">
                Helpful
              </p>
              <p className="mt-2 text-[26px] font-semibold text-[#22C55E]">
                {helpfulCount}
              </p>
            </div>
            <div className="rounded-[16px] border border-[#24242A] bg-[#0B0B0F] p-4">
              <p className="text-[12px] uppercase tracking-[0.16em] text-[#777A85]">
                Unhelpful
              </p>
              <p className="mt-2 text-[26px] font-semibold text-[#EF4444]">
                {unhelpfulCount}
              </p>
            </div>
          </section>
        )}

        {!error && feedback.length === 0 && (
          <div className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] p-6 text-[14px] text-[#777A85]">
            No feedback yet.
          </div>
        )}

        <div className="grid gap-4">
          {feedback.map((item) => (
            <article
              key={item.id}
              className="rounded-[18px] border border-[#24242A] bg-[#0B0B0F] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-[12px] font-semibold",
                      item.rating === "helpful"
                        ? "bg-[#22C55E]/10 text-[#22C55E]"
                        : "bg-[#EF4444]/10 text-[#EF4444]",
                    ].join(" ")}
                  >
                    {item.rating}
                  </span>
                  <span className="rounded-full border border-[#24242A] px-3 py-1 text-[12px] text-[#B3B3B3]">
                    {item.reason ?? "No reason"}
                  </span>
                </div>

                <p className="text-[12px] text-[#777A85]">
                  {formatDate(item.created_at)}
                </p>
              </div>

              <h2 className="mt-4 text-[18px] font-semibold text-white">
                {item.title}
              </h2>

              {item.text && (
                <p className="mt-3 rounded-[12px] border border-[#24242A] bg-[#101014] p-3 text-[13px] leading-6 text-[#E5E7EB]">
                  {item.text}
                </p>
              )}

              <p className="mt-3 text-[13px] leading-6 text-[#B3B3B3]">
                {item.script_preview}
              </p>

              <div className="mt-4 grid gap-2 text-[12px] text-[#777A85] sm:grid-cols-3">
                <p>Overall: {item.overall_score ?? "—"}</p>
                <p>Hook: {item.hook_score ?? "—"}</p>
                <p>Retention risk: {item.retention_risk ?? "—"}</p>
              </div>

              {item.main_takeaway && (
                <p className="mt-4 text-[12px] leading-5 text-[#777A85]">
                  {item.main_takeaway}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
