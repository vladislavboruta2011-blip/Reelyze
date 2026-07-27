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
      <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-[#3B82F6]/20 via-[#22D3EE]/10 to-transparent blur-2xl" />

      <div className="absolute left-0 top-4 w-[150px] rounded-[18px] border border-white/10 bg-[#12121F] p-3.5 shadow-[0_16px_50px_-18px_rgba(0,0,0,0.7)]">
        <div className="h-2 w-2/3 rounded-full bg-white/15" />
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-white/10" />
          <div className="h-1.5 w-5/6 rounded-full bg-white/10" />
          <div className="h-1.5 w-full rounded-full bg-white/10" />
          <div className="h-1.5 w-2/3 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="absolute right-0 top-20 w-[150px] rounded-[18px] border border-[#22D3EE]/25 bg-[#12121F] p-3.5 shadow-[0_16px_50px_-18px_rgba(0,0,0,0.7)]">
        <div className="h-2 w-2/3 rounded-full bg-[#67E8F9]/40" />
        <div className="mt-3 space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[#67E8F9]/20" />
          <div className="h-1.5 w-5/6 rounded-full bg-[#67E8F9]/20" />
          <div className="h-1.5 w-full rounded-full bg-[#67E8F9]/20" />
          <div className="h-1.5 w-2/3 rounded-full bg-[#67E8F9]/20" />
        </div>
      </div>

      <div className="absolute left-1/2 top-[86px] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-[#22D3EE]/40 bg-[#0D0D18] shadow-[0_0_50px_rgba(34,211,238,0.35)]">
        <ArrowLeftRight size={26} className="text-[#67E8F9]" strokeWidth={2.2} />
      </div>
    </div>
  );
}
