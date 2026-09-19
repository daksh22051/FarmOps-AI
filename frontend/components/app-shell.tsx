"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, Menu, Search, Sparkles, X } from "lucide-react";
import { useState, useMemo } from "react";
import { navItems } from "./navigation";
import { useFarm } from "../context/farm-context";
import { AuthModal } from "./auth-modal";
import { createClient } from "../lib/supabase/client";

function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-emerald-600/20 shadow-xs border border-emerald-500/30 ${className}`}>
      <Image
        src="/logo.png"
        alt="FarmOps AI Logo"
        width={40}
        height={40}
        className="h-full w-full object-cover"
        priority
      />
    </div>
  );
}

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const { unreadAlertCount } = useFarm();

  return (
    <nav aria-label="Primary navigation" className="space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href.split("?")[0]));
        return (
          <Link
            key={href}
            href={href}
            onClick={close}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              active
                ? "bg-[#1b7340] text-white shadow-sm"
                : "text-slate-300/85 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon aria-hidden="true" size={17} className={active ? "text-white" : "text-slate-400"} />
            <span>{label}</span>
            {label === "Alerts" && unreadAlertCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {unreadAlertCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { farm, currentUser, unreadAlertCount } = useFarm();

  // User display name & avatar initial
  const userDisplayName = useMemo(() => {
    if (!currentUser) return null;
    const metadata = currentUser.user_metadata || {};
    if (typeof metadata.full_name === "string" && metadata.full_name.trim()) {
      return metadata.full_name.trim();
    }
    if (typeof metadata.name === "string" && metadata.name.trim()) {
      return metadata.name.trim();
    }
    if (currentUser.email) {
      const prefix = currentUser.email.split("@")[0];
      return prefix
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return "Operator";
  }, [currentUser]);

  const userInitial = useMemo(() => {
    if (!userDisplayName) return "D";
    return userDisplayName.trim()[0]?.toUpperCase() || "D";
  }, [userDisplayName]);

  return (
    <div className="min-h-screen bg-[#f7f9f6] text-slate-800 lg:grid lg:grid-cols-[240px_1fr]">
      {/* ============================================================ */}
      {/* SIDEBAR (Desktop - Dark Forest Green matching Screenshot)    */}
      {/* ============================================================ */}
      <aside className="hidden border-r border-[#0d341e] bg-[#072414] px-3.5 py-5 lg:flex lg:flex-col lg:justify-between">
        <div>
          {/* Brand Logo & Slogan */}
          <div className="mb-7 flex items-center gap-2.5 px-2">
            <Logo />
            <div>
              <span className="text-base font-extrabold tracking-tight text-white block leading-tight">
                FarmOps AI
              </span>
              <span className="text-[10px] font-medium text-emerald-400/90 tracking-tight block">
                Smart Farms. Brighter Tomorrows.
              </span>
            </div>
          </div>

          <Navigation />
        </div>

        {/* Bottom Sustainable Agriculture Promo Card */}
        <div className="mt-6 rounded-2xl bg-gradient-to-b from-[#0e4225] to-[#082b18] border border-emerald-600/25 p-4 text-white relative overflow-hidden shadow-inner">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <Sparkles size={11} />
              AI Precision
            </span>
            <h4 className="mt-1 font-bold text-xs leading-snug text-white">
              AI for Sustainable Agriculture
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/75">
              Higher yields. Lower risks. Greener tomorrow.
            </p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-emerald-500/10 pointer-events-none" />
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA                                            */}
      {/* ============================================================ */}
      <div className="min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={22} />
            </button>

            {/* Global Search Bar (Ctrl K) matching Screenshot */}
            <div className="relative hidden md:flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search farms, zones, tasks..."
                className="w-72 lg:w-84 rounded-xl border border-slate-200 bg-[#f8faf7] pl-8 pr-16 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600/30 transition-all"
              />
              <span className="absolute right-2.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-400">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Right Header Actions (Bell + User Profile) */}
          <div className="flex items-center gap-3">
            <Link
              href="/alerts"
              aria-label="View alerts"
              className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:text-emerald-700 hover:border-slate-300 shadow-2xs"
            >
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white ring-2 ring-white">
                {unreadAlertCount > 0 ? unreadAlertCount : 3}
              </span>
            </Link>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  aria-label="Account and user details"
                  className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-800 shadow-2xs hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#1b7340] to-emerald-600 text-xs font-extrabold text-white shadow-xs">
                    {userInitial}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="font-bold text-slate-900 group-hover:text-emerald-950 text-xs leading-tight">
                      {userDisplayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none">
                      Farm Owner
                    </span>
                  </div>
                  <ChevronDown size={13} className="text-slate-400 ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase.auth.signOut();
                    window.location.href = "/login";
                  }}
                  className="rounded-full border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                  title="Sign out of FarmOps AI"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                aria-label="Log in to FarmOps AI"
                className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-800 shadow-2xs hover:border-emerald-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[#1b7340] text-xs font-extrabold text-white">
                  D
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-bold text-slate-900 text-xs leading-tight">
                    Demo User
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium leading-none">
                    Farm Owner
                  </span>
                </div>
                <ChevronDown size={13} className="text-slate-400 ml-0.5" />
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* Mobile Drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/25"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-[280px] bg-white px-4 py-6 shadow-2xl">
            <div className="mb-9 flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Logo />
                <span className="text-lg font-bold text-ink">FarmOps AI</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <Navigation close={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
