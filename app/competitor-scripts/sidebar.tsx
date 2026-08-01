import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Crown, History, Home, Swords } from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import type { Messages } from "../../lib/messages";
import { SidebarAccount } from "./sidebar-account";

// Every nav destination here is a real, existing route (/, /my-analyses,
// /competitor-scripts) — no speculative/placeholder items, so nothing in
// this sidebar can ever lead to a 404. This component is mounted on all
// five Competitor Scripts routes (the hub plus both modes' input and
// results pages), and the "Competitor Scripts" entry is always active on
// every one of them — switching between Analyze and Compare happens via
// the local ModeSwitcher on those pages instead, not via separate global
// rows here (see mode-switcher.tsx).
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
        "flex h-[46px] items-center gap-3 rounded-[12px] px-4 text-[14px] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]",
        active
          ? "border border-[#DDD6FE] bg-[#F3E8FF] font-semibold text-[#7C3AED]"
          : "font-medium text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]",
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
    <div className="flex items-center gap-3 rounded-[14px] border border-[#E5E7EB] bg-[#F8F8FC] px-4 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7]">
        <Crown size={15} className="text-[#B45309]" aria-hidden="true" />
      </div>
      <span className="text-[13px] font-medium text-[#111827]">{label}</span>
    </div>
  );
}

export function Sidebar({ messages }: { messages: Messages }) {
  const copy = messages.competitorScripts.modeSelection;

  return (
    <>
      {/* DESKTOP */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[260px] flex-col border-r border-[#E5E7EB] bg-white lg:flex">
        <div className="flex items-center gap-3 px-6 py-9">
          <Image
            src="/logo.png"
            alt="Climpy"
            width={36}
            height={36}
            className="h-9 w-9 object-contain"
            priority
          />
          <span className="text-[15px] font-bold tracking-[0.16em] text-[#111827]">
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
            active
          />
        </nav>

        <div className="mt-auto flex flex-col gap-4 px-4 pb-8">
          <LanguageSwitcher className="w-full justify-center" />
          <PlanCard label={copy.sidebar.freePlan} />
          <SidebarAccount />
        </div>
      </aside>

      {/* MOBILE */}
      <header className="flex flex-col border-b border-[#E5E7EB] bg-white lg:hidden">
        <div className="flex items-center justify-between px-5 pt-11 pb-4">
          <Link
            href="/"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-[#F8F8FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]"
            aria-label={copy.backLabel}
          >
            <ArrowLeft size={17} className="text-[#7C3AED]" />
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
            <span className="text-[14px] font-bold tracking-[0.16em] text-[#111827]">
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
