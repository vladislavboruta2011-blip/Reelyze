import type { ReactNode } from "react";
import type { ScoreData } from "../../engine/scoring";

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
