import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Crown,
  GitCompare,
  History,
  Home,
  PlayCircle,
  Swords,
} from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import type { Messages } from "../../lib/messages";
import { SidebarAccount } from "./sidebar-account";

// Every nav destination here is a real, existing route (/, /my-analyses,
// /competitor-scripts, /competitor-scripts/analyze, /competitor-scripts/
// compare) — no speculative/placeholder items, so nothing in this sidebar
// can ever lead to a 404. This component is mounted on five routes (the
// hub plus both modes' input and results pages), so active state is
// driven by the explicit `activeMode` prop each page passes in — never
// hardcoded — matching the existing NavItem `active` convention below.
function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex h-[46px] items-center gap-3 rounded-[12px] px-4 text-[14px] transition",
        active
          ? "border border-[#7C3AED]/40 bg-gradient-to-r from-[#7C3AED]/25 to-[#7C3AED]/5 font-semibold text-white shadow-[0_0_24px_rgba(124,58,237,0.18)]"
          : "font-medium text-[#9CA3AF] hover:bg-white/[0.04] hover:text-[#F5F5F7]",
      ].join(" ")}
    >
      {icon}
      {label}
    </Link>
  );
}

// Static "Free plan" label only — no usage numbers or progress bar, since
// there is no real usage-tracking or billing system behind this page yet.
function PlanCard({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F59E0B]/15">
        <Crown size={15} className="text-[#F59E0B]" aria-hidden="true" />
      </div>
      <span className="text-[13px] font-medium text-[#F5F5F7]">{label}</span>
    </div>
  );
}

export function Sidebar({
  messages,
  activeMode,
}: {
  messages: Messages;
  // Omitted (undefined) only on the hub page itself (/competitor-scripts),
  // where neither mode is "active" — set explicitly to "analyze" or
  // "compare" by every mode subpage (input and results).
  activeMode?: "analyze" | "compare";
}) {
  const copy = messages.competitorScripts.modeSelection;

  return (
    <>
      {/* DESKTOP */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[260px] flex-col border-r border-white/10 bg-[#0D0D18] lg:flex">
        <div className="flex items-center gap-3 px-6 py-9">
          <Image
            src="/logo.png"
            alt="Climpy"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-[15px] font-bold tracking-[0.16em] text-[#F5F5F7]">
            CLIMPY
          </span>
        </div>

        <nav className="flex flex-col gap-2 px-4">
          <NavItem href="/" icon={<Home size={17} />} label={messages.common.home} />
          <NavItem
            href="/my-analyses"
            icon={<History size={17} />}
            label={messages.common.myAnalyses}
          />
          <NavItem
            href="/competitor-scripts"
            icon={<Swords size={17} />}
            label={copy.pageTitle}
            active={activeMode === undefined}
          />
          <NavItem
            href="/competitor-scripts/analyze"
            icon={<PlayCircle size={17} />}
            label={copy.sidebar.analyzeLabel}
            active={activeMode === "analyze"}
          />
          <NavItem
            href="/competitor-scripts/compare"
            icon={<GitCompare size={17} />}
            label={copy.sidebar.compareLabel}
            active={activeMode === "compare"}
          />
        </nav>

        <div className="mt-auto flex flex-col gap-4 px-4 pb-8">
          <LanguageSwitcher className="w-full justify-center" />
          <PlanCard label={copy.sidebar.freePlan} />
          <SidebarAccount />
        </div>
      </aside>

      {/* MOBILE */}
      <header className="flex flex-col border-b border-white/10 bg-[#0D0D18] lg:hidden">
        <div className="flex items-center justify-between px-5 pt-11 pb-4">
          <Link
            href="/"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04]"
            aria-label={copy.backLabel}
          >
            <ArrowLeft size={17} className="text-[#C4B5FD]" />
          </Link>
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Climpy"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="text-[14px] font-bold tracking-[0.16em] text-[#F5F5F7]">
              CLIMPY
            </span>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="px-5 pb-4">
          <SidebarAccount compact />
        </div>
      </header>
    </>
  );
}
