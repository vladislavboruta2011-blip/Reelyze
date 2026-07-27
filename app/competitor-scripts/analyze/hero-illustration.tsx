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
      <div className="absolute inset-0 rounded-[32px] bg-gradient-to-br from-[#7C3AED]/20 via-[#3B82F6]/10 to-transparent blur-2xl" />

      <div className="absolute left-2 top-6 w-[225px] rounded-[22px] border border-white/10 bg-[#12121F] p-[18px] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/20 text-[#C4B5FD]">
            <PlayCircle size={20} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-3/4 rounded-full bg-white/15" />
            <div className="h-2.5 w-1/2 rounded-full bg-white/10" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-[7px] w-full rounded-full bg-white/10" />
          <div className="h-[7px] w-5/6 rounded-full bg-white/10" />
          <div className="h-[7px] w-full rounded-full bg-white/10" />
          <div className="h-[7px] w-2/3 rounded-full bg-white/10" />
        </div>

        <div className="mt-4 flex gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-[#7C3AED]/15 px-3 py-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#C4B5FD]" />
            <span className="h-[7px] w-7 rounded-full bg-[#C4B5FD]/50" />
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#3B82F6]/15 px-3 py-1.5">
            <span className="h-[7px] w-[7px] rounded-full bg-[#93C5FD]" />
            <span className="h-[7px] w-7 rounded-full bg-[#93C5FD]/50" />
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex h-[99px] w-[99px] items-center justify-center rounded-full border border-[#7C3AED]/40 bg-[#0D0D18] shadow-[0_0_60px_rgba(124,58,237,0.4)]">
        <Search size={40} className="text-[#A78BFA]" strokeWidth={2.2} />
      </div>

      <div className="absolute -top-1 right-11 flex h-10 w-10 items-center justify-center rounded-full border border-[#3B82F6]/40 bg-[#0D0D18]">
        <Sparkles size={18} className="text-[#93C5FD]" />
      </div>
    </div>
  );
}
