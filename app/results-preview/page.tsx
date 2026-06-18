"use client";

import { Inter } from "next/font/google";
import Link from "next/link";
import { useState } from "react";
import {
  AudioLines,
  FastForward,
  PencilLine,
  Scissors,
  ShieldCheck,
  SquarePen,
  Target,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_TITLE = "Why Ronaldo is so dangerous in the air";

const MOCK_SCRIPT_LINES = [
  { time: "0:00", text: "If your first 3 seconds feel slow, most viewers are already gone.", status: "normal" as const },
  { time: "0:05", text: "Reelyze finds the exact moment where retention starts dropping.", status: "normal" as const },
  { time: "0:12", text: "This line needs a stronger visual payoff.", status: "risky" as const },
  { time: "0:18", text: "Then it gives you clearer fixes before you upload.", status: "warning" as const },
];

const MOCK_SCORES = {
  overall: { score: 82, label: "Strong", color: "#22C55E", description: "Strong foundation with good pacing. A sharper payoff or more specific detail could push it further." },
  hook:    { score: 91, label: "Strong", color: "#22C55E", description: "Strong opening. It creates curiosity and gives viewers a clear reason to keep watching." },
  risk:    { score: 48, label: "Medium", color: "#FF9A1F", description: "Some sections may slow viewers down, especially where the script explains without building tension." },
};

const MOCK_RISKY_PARTS = [
  { time: "0:12 - 0:15", title: "Middle section may lose momentum.", description: "No contrast, escalation, or new tension was found in the middle section." },
  { time: "0:19 - 0:24", title: "Payoff needs a stronger ending.", description: "The ending may not feel rewarding. A clearer result or consequence would help." },
];

const MOCK_FIXES = [
  "Add a sharper contrast in the first line to stop viewers from scrolling past.",
  "Make the middle section build toward a clearer payoff — add a new consequence or reveal.",
  "Replace generic wording in the final line with a specific visual detail or result.",
];

const MOCK_SCENE_SEGMENTS = [
  { label: "Strong hook", color: "#22C55E", pct: 0.33 },
  { label: "Risky middle", color: "#EF4444", pct: 0.42 },
  { label: "Average ending", color: "#FF9A1F", pct: 0.25 },
];

const MOCK_SCALE_LABELS = ["0:00", "0:07", "0:14", "0:21", "0:28"];

// ─── Small helpers ────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[22px] border border-[#24242A] bg-[#0B0B0F] ${className}`}>
      {children}
    </div>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border border-[#3A1B22] bg-[#1A0D11] text-[#EF4444]">
      {children}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

// Reasons are now inline in ResultsSidebar

function ResultsSidebar({
  feedback,
  setFeedback,
  selectedReason,
  setSelectedReason,
  feedbackSubmitted,
  onOtherClick,
}: {
  feedback: "helpful" | "dislike" | null;
  setFeedback: (v: "helpful" | "dislike" | null) => void;
  selectedReason: string | null;
  setSelectedReason: (v: string | null) => void;
  feedbackSubmitted: boolean;
  onOtherClick: () => void;
}) {
  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-[230px] flex-col border-r border-[#24242A]/60 bg-[#050505]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-7">
        <img src="/logo.png" alt="Reelyze" className="h-9 w-9 object-contain" />
        <span className="text-[17px] font-bold tracking-[0.16em] text-white">REELYZE</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1.5 px-4">
        <Link
          href="/results-preview"
          className="flex h-[46px] items-center gap-3 rounded-[12px] border border-[#3A1B22] bg-[#1A0D11] px-4"
        >
          <SquarePen size={16} className="text-[#EF4444]" />
          <span className="text-[14px] font-semibold text-[#EF4444]">Results</span>
        </Link>

        <Link
          href="/"
          className="flex h-[46px] items-center gap-3 rounded-[12px] px-4 transition hover:bg-white/[0.03]"
        >
          <PencilLine size={16} className="text-[#777A85]" />
          <span className="text-[14px] font-medium text-[#777A85]">New Analysis</span>
        </Link>
      </nav>

      {/* Rate card */}
<div className="mt-[150px] px-4 pb-7">
        <div className="rounded-[18px] border border-[#24242A]/70 bg-[#0B0B0F] p-5">
          <p className="text-[14px] font-semibold text-white">Rate this analysis</p>
          <p className="mt-1.5 text-[12px] text-[#777A85]">Was this review helpful?</p>
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={() => { setFeedback("helpful"); setSelectedReason(null); }}
              className={[
                "flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-medium transition",
                feedback === "helpful"
                  ? "border-[#22C55E]/60 bg-[#22C55E]/10 text-[#22C55E]"
                  : "border-[#24242A] text-[#B3B3B3] hover:border-[#22C55E]/40 hover:text-white",
              ].join(" ")}
            >
              <ThumbsUp size={14} />
              Helpful
            </button>
            <button
              onClick={() => { setFeedback(feedback === "dislike" ? null : "dislike"); setSelectedReason(null); }}
              className={[
                "flex h-[38px] w-[42px] items-center justify-center rounded-[10px] border transition",
                feedback === "dislike"
                  ? "border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]"
                  : "border-[#24242A] text-[#B3B3B3] hover:border-white/20 hover:text-white",
              ].join(" ")}
            >
              <ThumbsDown size={14} />
            </button>
          </div>

          {feedback === "helpful" && (
            <div className="mt-3 flex flex-col gap-1.5">
              {["Accurate score", "Useful fixes", "Clear explanation", "Other"].map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    if (reason === "Other") { onOtherClick(); return; }
                    setSelectedReason(selectedReason === reason ? null : reason);
                  }}
                  className={[
                    "w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition",
                    selectedReason === reason
                      ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]"
                      : "border-[#24242A] text-[#777A85] hover:border-[#22C55E]/30 hover:text-[#B3B3B3]",
                  ].join(" ")}
                >
                  {reason}
                </button>
              ))}
            </div>
          )}

          {feedback === "dislike" && (
            <div className="mt-3 flex flex-col gap-1.5">
              {["Wrong score", "Bad suggestions", "Not specific enough", "Other"].map((reason) => (
                <button
                  key={reason}
                  onClick={() => {
                    if (reason === "Other") { onOtherClick(); return; }
                    setSelectedReason(selectedReason === reason ? null : reason);
                  }}
                  className={[
                    "w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition",
                    selectedReason === reason
                      ? "border-[#EF4444]/50 bg-[#EF4444]/10 text-[#EF4444]"
                      : "border-[#24242A] text-[#777A85] hover:border-[#EF4444]/30 hover:text-[#B3B3B3]",
                  ].join(" ")}
                >
                  {reason}
                </button>
              ))}
            </div>
          )}

          {feedbackSubmitted && (
            <p className="mt-2.5 text-[12px] text-[#22C55E]">Thanks for the feedback!</p>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function ResultsHeader() {
  return (
    <div className="mb-7 flex items-start justify-between gap-6">
      <div>
        <h1 className="text-[36px] font-semibold tracking-[-0.02em] text-white">Script Review</h1>
        <p className="mt-1.5 text-[14px] text-[#777A85]">
          Analyzed just now — <span className="text-[#B3B3B3]">{MOCK_TITLE}</span>
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex h-[42px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-5 text-[14px] font-semibold text-white transition hover:border-[#EF4444]/50 hover:bg-[#EF4444]/10"
      >
        <PencilLine size={15} />
        New Analysis
      </Link>
    </div>
  );
}

// ─── Score cards ──────────────────────────────────────────────────────────────

function ScoreCard({
  title,
  score,
  label,
  color,
  description,
}: {
  title: string;
  score: number;
  label: string;
  color: string;
  description: string;
}) {
  return (
    <Card className="p-6">
      <p className="text-[13px] font-medium text-[#777A85]">{title}</p>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-white">{score}</span>
        <span className="text-[14px] text-[#777A85]">/100</span>
      </div>

      <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#1C1C22]">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}55` }}
        />
      </div>

      <p className="mt-3.5 text-[14px] font-semibold" style={{ color }}>{label}</p>
      <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85] line-clamp-2">{description}</p>
    </Card>
  );
}

function ScoreOverview() {
  return (
    <div className="mb-6 grid grid-cols-3 gap-5">
      <ScoreCard title="Overall Score" {...MOCK_SCORES.overall} />
      <ScoreCard title="Hook Score"    {...MOCK_SCORES.hook} />
      <ScoreCard title="Retention Risk" {...MOCK_SCORES.risk} />
    </div>
  );
}

// ─── Main takeaway ─────────────────────────────────────────────────────────────

function MainTakeaway() {
  return (
    <div className="mb-6 rounded-[16px] border border-[#3A1B22] bg-[#1A0D11] px-5 py-4 shadow-[0_0_28px_rgba(239,68,68,0.07)]">
      <div className="flex items-start gap-3">
        <Target size={16} className="mt-0.5 shrink-0 text-[#EF4444]" />
        <div>
          <p className="text-[12.5px] font-semibold text-[#EF4444]">Main Takeaway</p>
          <p className="mt-1 text-[13px] leading-[1.6] text-[#E8D5D8]">
            {MOCK_SCORES.overall.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Script card ─────────────────────────────────────────────────────────────

function ScriptLineRow({
  time,
  text,
  status,
}: {
  time: string;
  text: string;
  status: "normal" | "warning" | "risky";
}) {
  const isRisky   = status === "risky";
  const isWarning = status === "warning";

  return (
    <div
      className={[
        "grid grid-cols-[48px_1fr] gap-3 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.6]",
        isRisky   ? "border border-[#3A1B22] bg-[#1A0D11]" :
        isWarning ? "border border-[#FF9A1F]/25 bg-[#FF9A1F]/[0.06]" :
                    "border border-transparent",
      ].join(" ")}
    >
      <span className={isRisky ? "text-[#EF4444]" : isWarning ? "text-[#FF9A1F]" : "text-[#777A85]"}>{time}</span>
      <span className={isRisky ? "text-[#EF4444]" : isWarning ? "text-[#FF9A1F]" : "text-[#B3B3B3]"}>{text}</span>
    </div>
  );
}

function ScriptCard() {
  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-[17px] font-semibold text-white">Your Script</h2>
        <div className="flex items-center gap-2 rounded-[8px] border border-[#24242A] bg-[#101014] px-3 py-1">
          <span className="text-[12px] text-[#777A85]">Topic:</span>
          <span className="text-[12px] font-medium text-white">{MOCK_TITLE}</span>
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-[16px] border border-[#24242A] bg-[#101014] p-4">
        <div className="flex flex-col gap-2">
          {MOCK_SCRIPT_LINES.map((line) => (
            <ScriptLineRow key={line.time} {...line} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-4 text-[12px] text-[#777A85]">
        312 / 1000 characters — ~0:28 estimated
      </p>

      {/* Balance filler: main takeaway preview */}
      <div className="mt-4 rounded-[14px] border border-[#24242A] bg-[#101014] px-4 py-3.5">
        <p className="text-[12px] font-semibold text-[#777A85] uppercase tracking-[0.08em]">Quick Summary</p>
        <p className="mt-2 text-[13px] leading-[1.6] text-[#B3B3B3]">
          Strong hook with good pacing. The middle section could build more tension before the payoff arrives.
        </p>
      </div>
    </Card>
  );
}

// ─── Risky parts card ─────────────────────────────────────────────────────────

function RiskyPartsCard() {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-white">Risky Parts</h2>
        <span className="text-[12px] font-medium text-[#777A85]">{MOCK_RISKY_PARTS.length} found</span>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_RISKY_PARTS.map((part) => (
          <div key={part.time} className="rounded-[14px] border border-[#24242A] bg-[#101014] p-4">
            <p className="text-[12px] font-semibold text-[#EF4444]">{part.time}</p>
            <p className="mt-1.5 text-[14px] font-medium text-white">{part.title}</p>
            <p className="mt-1 text-[13px] leading-[1.55] text-[#777A85]">{part.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Suggested fixes card ─────────────────────────────────────────────────────

const FIX_ICONS = [
  <AudioLines size={18} key="a" />,
  <Scissors   size={18} key="b" />,
  <FastForward size={18} key="c" />,
];

function SuggestedFixesCard({ onImproveHook }: { onImproveHook: () => void }) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-white">Suggested Fixes</h2>
        <span className="text-[12px] font-medium text-[#777A85]">{MOCK_FIXES.length} suggestions</span>
      </div>

     {/* Improve Hook CTA */}
      <button
        onClick={onImproveHook}
        className="mb-5 inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white shadow-[0_0_32px_rgba(220,38,38,0.30)] transition hover:bg-[#EF4444]"
      >
        <ShieldCheck size={15} />
        Improve Hook
      </button>

      <div className="flex flex-col gap-3">
        {MOCK_FIXES.map((fix, i) => (
          <div key={i} className="flex items-start gap-3 rounded-[12px] border border-[#24242A] bg-[#101014] px-3 py-3">
            <IconBox>{FIX_ICONS[i % 3]}</IconBox>
            <p className="text-[13px] leading-[1.65] text-[#B3B3B3]">{fix}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Scene breakdown card ─────────────────────────────────────────────────────

function SceneBreakdownCard() {
  return (
    <Card className="mt-4 p-6">
      <h2 className="mb-4 text-[17px] font-semibold text-white">Scene Breakdown</h2>

      {/* Bar */}
      <div className="flex h-[7px] w-full overflow-hidden rounded-full bg-[#1C1C22]">
        {MOCK_SCENE_SEGMENTS.map((seg) => (
          <div
            key={seg.label}
            className="h-full"
            style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color, opacity: 0.88 }}
          />
        ))}
      </div>

      {/* Time labels */}
      <div className="mt-3 grid grid-cols-5 text-[11.5px] text-[#555560]">
        {MOCK_SCALE_LABELS.map((label, i) => (
          <p key={label} className={i === 4 ? "text-right" : ""}>{label}</p>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6">
        {MOCK_SCENE_SEGMENTS.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span
              className="h-[4px] w-[16px] rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-[12px] text-[#777A85]">{seg.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResultsPreviewPage() {
  const [feedback, setFeedback] = useState<"helpful" | "dislike" | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [hookModalOpen, setHookModalOpen] = useState(false);
  const [otherFeedbackOpen, setOtherFeedbackOpen] = useState(false);
  const [otherFeedbackText, setOtherFeedbackText] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [copiedHook, setCopiedHook] = useState(false);

  return (
    <div className={`${inter.className} min-h-screen bg-[#050505] text-white antialiased`}>
      <ResultsSidebar
        feedback={feedback}
        setFeedback={setFeedback}
        selectedReason={selectedReason}
        setSelectedReason={setSelectedReason}
        feedbackSubmitted={feedbackSubmitted}
        onOtherClick={() => setOtherFeedbackOpen(true)}
      />

      {/* Main content pushed right of the fixed sidebar */}
      <section className="min-h-screen lg:pl-[230px]">
        <div className="mx-auto w-full max-w-[1320px] px-9 py-11">

          <ResultsHeader />
          <ScoreOverview />
          <MainTakeaway />

          <div className="grid grid-cols-[1.35fr_0.9fr] items-start gap-5">
            <ScriptCard />
            <div className="flex flex-col gap-6">
              <RiskyPartsCard />
             <SuggestedFixesCard onImproveHook={() => setHookModalOpen(true)} />
            </div>
          </div>

          <SceneBreakdownCard />

        </div>
      </section>

      {/* Hook modal */}
      {hookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
          <div className="relative w-full max-w-[500px] rounded-[24px] border border-[#24242A] bg-[#0B0B0F] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
            <button
              onClick={() => setHookModalOpen(false)}
              className="absolute right-5 top-5 text-[20px] text-[#777A85] transition hover:text-white"
            >
              ×
            </button>
            <h2 className="text-[20px] font-semibold text-white">Improved Hook</h2>
            <p className="mt-1.5 text-[13px] text-[#777A85]">Use this version to create a stronger opening.</p>
            <div className="mt-5 rounded-[14px] border border-[#3A1B22] bg-[#1A0D11] px-5 py-4">
              <p className="text-[15px] leading-[1.65] text-[#F3E7E9]">
                "If your first 3 seconds feel slow, you've already lost them — and most creators never find out why."
              </p>
            </div>
            <p className="mt-4 text-[13px] leading-[1.6] text-[#777A85]">
              Why it's stronger: leads with the consequence before the setup, so viewers feel the stakes immediately.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  try { navigator.clipboard.writeText("If your first 3 seconds feel slow, you've already lost them — and most creators never find out why."); } catch (_) {}
                  setCopiedHook(true);
                  setTimeout(() => setCopiedHook(false), 1800);
                }}
                className={[
                  "h-[40px] rounded-[10px] px-5 text-[13px] font-semibold text-white transition",
                  copiedHook
                    ? "bg-[#22C55E] hover:bg-[#22C55E]"
                    : "bg-[#DC2626] hover:bg-[#EF4444]",
                ].join(" ")}
              >
                {copiedHook ? "Copied!" : "Copy Hook"}
              </button>
              <button
                onClick={() => setHookModalOpen(false)}
                className="h-[40px] rounded-[10px] border border-[#24242A] bg-[#101014] px-5 text-[13px] font-semibold text-white transition hover:bg-[#17171C]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Other feedback modal */}
      {otherFeedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px]">
          <div className="relative w-full max-w-[460px] rounded-[24px] border border-[#24242A] bg-[#0B0B0F] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
            <button
              onClick={() => setOtherFeedbackOpen(false)}
              className="absolute right-5 top-5 text-[20px] text-[#777A85] transition hover:text-white"
            >
              ×
            </button>

            <h2 className="text-[20px] font-semibold text-white">
              {feedback === "helpful" ? "What did you like?" : "What did not work?"}
            </h2>

            <p className="mt-1.5 text-[13px] text-[#777A85]">
              Your feedback helps improve Reelyze.
            </p>

            <textarea
              value={otherFeedbackText}
              onChange={(e) => setOtherFeedbackText(e.target.value)}
              placeholder={
                feedback === "helpful"
                  ? "Tell us what you liked about this analysis..."
                  : "Tell us what was wrong or missing..."
              }
              rows={5}
              className="mt-5 w-full resize-none rounded-[12px] border border-[#24242A] bg-[#101014] px-4 py-3 text-[13px] leading-[1.65] text-[#B3B3B3] outline-none placeholder:text-[#555560]"
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setOtherFeedbackOpen(false);
                  setOtherFeedbackText("");
                  setFeedbackSubmitted(true);
                }}
                className="h-[40px] rounded-[10px] bg-[#DC2626] px-5 text-[13px] font-semibold text-white transition hover:bg-[#EF4444]"
              >
                Submit
              </button>

              <button
                onClick={() => setOtherFeedbackOpen(false)}
                className="h-[40px] rounded-[10px] border border-[#24242A] bg-[#101014] px-5 text-[13px] font-semibold text-white transition hover:bg-[#17171C]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}