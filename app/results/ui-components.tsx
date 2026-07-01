import type { ReactNode } from "react";

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
