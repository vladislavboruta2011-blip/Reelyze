import type { ReactNode } from "react";
import { AudioLines, FastForward, Scissors } from "lucide-react";
import type { RiskyPart, SceneSegment, ScoreData } from "../../engine/scoring";
import type { AnalysisV2UiScoreBreakdown } from "../../engine/analysis-v2-ui-adapter";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[22px] border border-[#E5E7EB] bg-white ${className}`}>
      {children}
    </div>
  );
}

export function IconBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] border border-[#DDD6FE] bg-[#F3E8FF] text-[#7C3AED]">
      {children}
    </div>
  );
}

const HELPFUL_FEEDBACK_REASONS = [
  "Accurate score",
  "Useful fixes",
  "Clear explanation",
  "Other",
];

const UNHELPFUL_FEEDBACK_REASONS = [
  "Wrong score",
  "Bad suggestions",
  "Not specific enough",
  "Other",
];

export function FeedbackReasonOptions({
  rating,
  selectedReason,
  disabled,
  onSelect,
  compact = false,
}: {
  rating: "helpful" | "unhelpful";
  selectedReason: string | null;
  disabled: boolean;
  onSelect: (reason: string) => void;
  compact?: boolean;
}) {
  const reasons =
    rating === "helpful"
      ? HELPFUL_FEEDBACK_REASONS
      : UNHELPFUL_FEEDBACK_REASONS;

  const selectedClasses =
    rating === "helpful"
      ? "border-[#22C55E]/50 bg-[#22C55E]/10 text-[#22C55E]"
      : "border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#7C3AED]";

  const unselectedClasses = [
    "border-[#E5E7EB]",
    compact ? "bg-[#F8F8FC]" : "",
    "text-[#6B7280]",
    rating === "helpful"
      ? "hover:border-[#22C55E]/30 hover:text-[#6B7280]"
      : "hover:border-[#7C3AED]/30 hover:text-[#6B7280]",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      {reasons.map((reason) => (
        <button
          key={reason}
          disabled={disabled}
          onClick={() => onSelect(reason)}
          className={[
            "w-full rounded-[8px] border px-2.5 py-2 text-left text-[12px] font-medium transition",
            selectedReason === reason
              ? selectedClasses
              : unselectedClasses,
          ].join(" ")}
        >
          {reason}
        </button>
      ))}
    </div>
  );
}

export function DesktopScoreCard({
  title,
  data,
  accentColor,
}: {
  title: string;
  data: ScoreData;
  accentColor: string;
}) {
  return (
    <Card className="p-6">
      <p className="text-[13px] font-medium text-[#6B7280]">{title}</p>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[40px] font-bold leading-none tracking-[-0.03em] text-[#111827]">
          {data.score}
        </span>
        <span className="text-[14px] text-[#6B7280]">/100</span>
      </div>
      <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-[#E5E7EB]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${data.score}%`,
            backgroundColor: accentColor,
            boxShadow: `0 0 8px ${accentColor}55`,
          }}
        />
      </div>
      <p
        className="mt-3.5 text-[14px] font-semibold"
        style={{ color: accentColor }}
      >
        {data.label}
      </p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-[1.55] text-[#6B7280]">
        {data.description}
      </p>
    </Card>
  );
}

export function MobileScoreCards({
  overall,
  hook,
  risk,
}: {
  overall: ScoreData;
  hook: ScoreData;
  risk: ScoreData;
}) {
  const items = [
    {
      label: "Overall",
      score: overall.score,
      color: overall.ringColor,
      status: overall.label,
    },
    {
      label: "Hook",
      score: hook.score,
      color: hook.color,
      status: hook.label,
    },
    {
      label: "Risk",
      score: risk.score,
      color: risk.color,
      status: risk.label,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center justify-center gap-1 rounded-[16px] border border-[#E5E7EB] bg-white px-2 py-4"
        >
          <p className="text-center text-[10px] font-medium text-[#6B7280]">
            {item.label}
          </p>
          <span className="text-[32px] font-bold leading-none tracking-[-0.03em] text-[#111827]">
            {item.score}
          </span>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#E5E7EB]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${item.score}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <p
            className="text-[10px] font-semibold"
            style={{ color: item.color }}
          >
            {item.status}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ScoreBreakdownCard({
  breakdown,
  compact = false,
}: {
  breakdown: AnalysisV2UiScoreBreakdown;
  compact?: boolean;
}) {
  const groups = [
    breakdown.overall,
    breakdown.hook,
    breakdown.risk,
  ];

  return (
    <Card className={compact ? "p-4" : "p-6"}>
      <div>
        <h2
          className={
            compact
              ? "text-[15px] font-semibold text-[#111827]"
              : "text-[17px] font-semibold text-[#111827]"
          }
        >
          Why these scores?
        </h2>
        <p
          className={
            compact
              ? "mt-1 text-[11px] leading-[1.55] text-[#6B7280]"
              : "mt-1.5 text-[13px] leading-[1.55] text-[#6B7280]"
          }
        >
          Each total is built from four components
          scored out of 25. Lower is better for
          Retention Risk.
        </p>
      </div>

      <div
        className={
          compact
            ? "mt-4 grid grid-cols-1 gap-3"
            : "mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3"
        }
      >
        {groups.map((group) => {
          const accentColor =
            group.direction === "higher-is-riskier"
              ? "#EF4444"
              : group.title === "Hook Score"
                ? "#22C55E"
                : "#7C3AED";

          return (
            <div
              key={group.title}
              className={
                compact
                  ? "rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] p-3.5"
                  : "rounded-[16px] border border-[#E5E7EB] bg-[#F8F8FC] p-4"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">
                    {group.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#6B7280]">
                    {group.direction ===
                    "higher-is-riskier"
                      ? "Lower is better"
                      : "Higher is better"}
                  </p>
                </div>

                <div className="flex shrink-0 items-baseline gap-1">
                  <span
                    className="text-[22px] font-bold leading-none"
                    style={{ color: accentColor }}
                  >
                    {group.total}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    /100
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3.5">
                {group.items.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold text-[#374151]">
                        {item.label}
                      </p>
                      <p className="shrink-0 text-[11px] font-semibold text-[#111827]">
                        {item.score}
                        <span className="font-normal text-[#9CA3AF]">
                          /{item.maxScore}
                        </span>
                      </p>
                    </div>

                    <div className="mt-1.5 h-[4px] overflow-hidden rounded-full bg-[#E5E7EB]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              item.score * 4
                            )
                          )}%`,
                          backgroundColor: accentColor,
                        }}
                      />
                    </div>

                    <p className="mt-1.5 text-[10.5px] leading-[1.45] text-[#6B7280]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function RiskyPartItem({
  part,
  compact = false,
}: {
  part: RiskyPart;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] p-4"
          : "rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] p-4"
      }
    >
      <p
        className={
          compact
            ? "text-[11px] font-semibold text-[#7C3AED]"
            : "text-[12px] font-semibold text-[#7C3AED]"
        }
      >
        {part.time}
      </p>
      <p
        className={
          compact
            ? "mt-1 text-[13px] font-medium text-[#111827]"
            : "mt-1.5 text-[14px] font-medium text-[#111827]"
        }
      >
        {part.title}
      </p>
      <p
        className={
          compact
            ? "mt-0.5 text-[12px] leading-[1.5] text-[#6B7280]"
            : "mt-1 text-[13px] leading-[1.55] text-[#6B7280]"
        }
      >
        {part.description}
      </p>
    </div>
  );
}

export function RiskyPartsContent({
  parts,
  hasFixes,
  compact = false,
}: {
  parts: RiskyPart[];
  hasFixes: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "px-4 pb-4 flex flex-col gap-2.5"
          : "flex flex-col gap-3"
      }
    >
      {parts.length === 0 ? (
        <div
          className={
            compact
              ? "rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3"
              : ""
          }
        >
          <p
            className={
              compact
                ? "text-[13px] font-medium text-[#111827]"
                : "text-[14px] font-medium text-[#111827]"
            }
          >
            {hasFixes ? "No major risky parts found." : "No risky parts found."}
          </p>
          <p
            className={
              compact
                ? "mt-1 text-[12px] leading-[1.5] text-[#6B7280]"
                : "mt-1 text-[13px] leading-[1.55] text-[#6B7280]"
            }
          >
            {hasFixes
              ? "No material drop-off points were found; the suggestions below are optional refinements."
              : "This script stays focused and does not contain any major drop-off points."}
          </p>
        </div>
      ) : (
        parts.map((part) => (
          <RiskyPartItem
            key={`${part.time}-${part.title}`}
            part={part}
            compact={compact}
          />
        ))
      )}
    </div>
  );
}

export function SuggestedFixItem({
  fix,
  index,
  compact = false,
}: {
  fix: string;
  index: number;
  compact?: boolean;
}) {
  const FixIcon =
    index % 3 === 0 ? AudioLines : index % 3 === 1 ? Scissors : FastForward;

  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-3 py-3">
      <IconBox>
        <FixIcon size={compact ? 16 : 18} />
      </IconBox>
      <p
        className={
          compact
            ? "flex-1 text-[12px] leading-[1.6] text-[#6B7280]"
            : "text-[13px] leading-[1.65] text-[#6B7280]"
        }
      >
        {fix}
      </p>
    </div>
  );
}

export function SuggestedFixesContent({
  fixes,
  compact = false,
}: {
  fixes: string[];
  compact?: boolean;
}) {
  if (fixes.length === 0) {
    return (
      <div
        className={
          compact
            ? "rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3"
            : ""
        }
      >
        <p
          className={
            compact
              ? "text-[13px] font-medium text-[#111827]"
              : "text-[14px] font-medium text-[#111827]"
          }
        >
          No fixes needed.
        </p>
        <p
          className={
            compact
              ? "mt-1 text-[12px] text-[#6B7280]"
              : "mt-1 text-[13px] leading-[1.55] text-[#6B7280]"
          }
        >
          {compact
            ? "The script already performs well."
            : "The script already performs well based on the current analysis."}
        </p>
      </div>
    );
  }

  return fixes.map((fix, index) => (
    <SuggestedFixItem
      key={`${fix}-${index}`}
      fix={fix}
      index={index}
      compact={compact}
    />
  ));
}

export function SceneBreakdownContent({
  segments,
  scaleLabels,
  compact = false,
}: {
  segments: SceneSegment[];
  scaleLabels: string[];
  compact?: boolean;
}) {
  return (
    <>
      <div
        className={
          compact
            ? "mb-3 flex h-[6px] w-full overflow-hidden rounded-full bg-[#E5E7EB]"
            : "flex h-[7px] w-full overflow-hidden rounded-full bg-[#E5E7EB]"
        }
      >
        {segments.map((segment, index) => {
          const pct = segment.width / 1110;

          return (
            <div
              key={`${segment.label}-${index}`}
              className="h-full"
              style={{
                width: `${pct * 100}%`,
                backgroundColor: segment.color,
                opacity: compact ? 0.9 : 0.88,
              }}
            />
          );
        })}
      </div>

      <div
        className={
          compact
            ? "mb-3 grid grid-cols-5 text-[10px] text-[#9CA3AF]"
            : "mt-3 grid grid-cols-5 text-[11.5px] text-[#9CA3AF]"
        }
      >
        {scaleLabels.map((label, index) => (
          <p
            key={label}
            className={index === scaleLabels.length - 1 ? "text-right" : ""}
          >
            {label}
          </p>
        ))}
      </div>

      <div
        className={
          compact
            ? "flex flex-wrap gap-3"
            : "mt-4 flex items-center gap-6"
        }
      >
        {segments.map((segment, index) => (
          <div
            key={`${segment.label}-${index}`}
            className={compact ? "flex items-center gap-1.5" : "flex items-center gap-2"}
          >
            <span
              className={
                compact
                  ? "h-[3px] w-[14px] rounded-full"
                  : "h-[4px] w-[16px] rounded-full"
              }
              style={{ backgroundColor: segment.color }}
            />
            <span
              className={
                compact
                  ? "text-[11px] text-[#6B7280]"
                  : "text-[12px] text-[#6B7280]"
              }
            >
              {segment.label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ScriptLinesContent({
  lines,
  timestamps,
  riskyLineIndexes,
  warningLineIndexes,
  fallbackTimestamp,
  compact = false,
}: {
  lines: string[];
  timestamps: string[];
  riskyLineIndexes: number[];
  warningLineIndexes: number[];
  fallbackTimestamp: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"}>
      {lines.map((line, index) => {
        const isRisky = riskyLineIndexes.includes(index);
        const isWarning =
          !isRisky && warningLineIndexes.includes(index);

        const timestampColor = isRisky
          ? "text-[#7C3AED]"
          : isWarning
            ? "text-[#FF9A1F]"
            : compact
              ? "text-[#9CA3AF]"
              : "text-[#6B7280]";

        const lineColor = isRisky
          ? "text-[#7C3AED]"
          : isWarning
            ? "text-[#FF9A1F]"
            : "text-[#6B7280]";

        const statusClasses = isRisky
          ? "border border-[#DDD6FE] bg-[#F3E8FF]"
          : isWarning
            ? compact
              ? "border border-[#FF9A1F]/20 bg-[#FF9A1F]/[0.05]"
              : "border border-[#FF9A1F]/25 bg-[#FF9A1F]/[0.06]"
            : "border border-transparent";

        return (
          <div
            key={`${timestamps[index] ?? index}-${line}`}
            className={[
              compact
                ? "grid grid-cols-[44px_1fr] gap-2.5 rounded-[8px] px-2.5 py-2 text-[12px] leading-[1.55]"
                : "grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-3 rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.6]",
              statusClasses,
            ].join(" ")}
          >
            <span className={timestampColor}>
              {timestamps[index] ?? fallbackTimestamp}
            </span>
            <span
              className={
                compact
                  ? lineColor
                  : `${lineColor} min-w-0 break-words [overflow-wrap:anywhere]`
              }
            >
              {line}
            </span>
          </div>
        );
      })}
    </div>
  );
}
