import { PlayCircle, Search, Sparkles } from "lucide-react";

// Purely decorative — fills otherwise-empty hero space with an abstract
// "video card being scanned" motif. No real creator, thumbnail, title, or
// metrics: every line/bar/badge here is a plain shape, never real or
// fabricated text content. aria-hidden on the outer wrapper removes the
// entire illustration from assistive tech; nothing inside it is
// independently focusable or announced.
export function HeroIllustration() {
  return (
    <div aria-hidden="true" className="relative h-[270px] w-[270px]">
      <div className="absolute left-2 top-6 w-[225px] rounded-[22px] border border-[#E5E7EB] bg-white p-[18px] shadow-[0_20px_60px_-20px_rgba(17,24,39,0.15)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7C3AED]">
            <PlayCircle size={20} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-3/4 rounded-full bg-[#E5E7EB]" />
            <div className="h-2.5 w-1/2 rounded-full bg-[#F3F4F6]" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-[7px] w-full rounded-full bg-[#F3F4F6]" />
          <div className="h-[7px] w-5/6 rounded-full bg-[#F3F4F6]" />
          <div className="h-[7px] w-full rounded-full bg-[#F3F4F6]" />
          <div className="h-[7px] w-2/3 rounded-full bg-[#F3F4F6]" />
        </div>

        <div className="mt-4 flex gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[#F3E8FF] px-3 py-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#7C3AED]" />
            <span className="h-[7px] w-7 rounded-full bg-[#7C3AED]/50" />
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#DBEAFE] px-3 py-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#2563EB]" />
            <span className="h-[7px] w-7 rounded-full bg-[#2563EB]/50" />
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex h-[99px] w-[99px] items-center justify-center rounded-full border border-[#DDD6FE] bg-white shadow-[0_10px_40px_rgba(124,58,237,0.18)]">
        <Search size={40} className="text-[#7C3AED]" strokeWidth={2.2} />
      </div>

      <div className="absolute -top-1 right-11 flex h-10 w-10 items-center justify-center rounded-full border border-[#BFDBFE] bg-white">
        <Sparkles size={18} className="text-[#2563EB]" />
      </div>
    </div>
  );
}
