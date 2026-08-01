import { ArrowLeftRight } from "lucide-react";

// Purely decorative — two abstract "script card" shapes with a comparison
// badge between them. No real creator, video, title, logo, or metrics:
// every bar/card here is a plain shape, never real or fabricated text
// content. Deliberately distinct from the Analyze page's magnifying-glass
// motif. aria-hidden on the outer wrapper removes the entire illustration
// from assistive tech; nothing inside it is independently focusable.
export function HeroIllustration() {
  return (
    <div aria-hidden="true" className="relative h-[240px] w-[270px]">
      <div className="absolute left-0 top-4 w-[150px] rounded-[18px] border border-[#E5E7EB] bg-white p-3.5 shadow-[0_16px_50px_-18px_rgba(17,24,39,0.14)]">
        <div className="h-2 w-2/3 rounded-full bg-[#E5E7EB]" />
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[#F3F4F6]" />
          <div className="h-1.5 w-5/6 rounded-full bg-[#F3F4F6]" />
          <div className="h-1.5 w-full rounded-full bg-[#F3F4F6]" />
          <div className="h-1.5 w-2/3 rounded-full bg-[#F3F4F6]" />
        </div>
      </div>

      <div className="absolute right-0 top-20 w-[150px] rounded-[18px] border border-[#BFDBFE] bg-white p-3.5 shadow-[0_16px_50px_-18px_rgba(17,24,39,0.14)]">
        <div className="h-2 w-2/3 rounded-full bg-[#93C5FD]" />
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[#DBEAFE]" />
          <div className="h-1.5 w-5/6 rounded-full bg-[#DBEAFE]" />
          <div className="h-1.5 w-full rounded-full bg-[#DBEAFE]" />
          <div className="h-1.5 w-2/3 rounded-full bg-[#DBEAFE]" />
        </div>
      </div>

      <div className="absolute left-1/2 top-[86px] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-[#BFDBFE] bg-white shadow-[0_10px_30px_rgba(37,99,235,0.18)]">
        <ArrowLeftRight size={26} className="text-[#2563EB]" strokeWidth={2.2} />
      </div>
    </div>
  );
}
