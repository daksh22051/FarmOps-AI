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
    <div className={`relative shrink-0 overflow-hidden rounded-xl bg-emerald-500/10 shadow-xs border border-emerald-500/20 ${className}`}>
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
    <nav aria-label="Primary navigation" className="space-y-1 px-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href.split("?")[0]));
        return (
          <Link
            key={href}
            href={href}
            onClick={close}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
              active
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200/90 font-semibold shadow-xs"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
            }`}
          >
            <Icon
              aria-hidden="true"
              size={17}
              className={`transition-colors ${active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"}`}
            />
            <span>{label}</span>
            {label === "Alerts" && unreadAlertCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
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
    <div className="min-h-screen bg-slate-50 text-slate-800 lg:grid lg:grid-cols-[256px_1fr]">
      {/* ============================================================ */}
      {/* SIDEBAR — Clean Light Theme with Emerald Accents             */}
      {/* ============================================================ */}
      <aside className="hidden glass-sidebar border-r border-slate-200 px-3 py-5 lg:flex lg:flex-col lg:justify-between">
        <div>
          {/* Brand Logo & Slogan */}
          <div className="mb-8 flex items-center gap-3 px-3">
            <Logo />
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
                FarmOps AI
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 tracking-tight block">
                Smart Farms. Brighter Tomorrows.
              </span>
            </div>
          </div>

          <Navigation />
        </div>

        {/* Bottom Promo Card */}
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-cyan-50 border border-emerald-200/80 p-4 text-slate-800 relative overflow-hidden shadow-xs">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <Sparkles size={11} />
              AI Precision
            </span>
            <h4 className="mt-1.5 font-bold text-xs leading-snug text-slate-900">
              AI for Sustainable Agriculture
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
              Higher yields. Lower risks. Greener tomorrow.
            </p>
          </div>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA                                            */}
      {/* ============================================================ */}
      <div className="min-w-0 flex flex-col">
        {/* Top Header — Clean Glass Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 glass-header px-4 sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden transition"
            >
              <Menu size={22} />
            </button>

            {/* Global Search Bar */}
            <div className="relative hidden md:flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search farms, zones, tasks..."
                className="w-72 lg:w-80 rounded-xl bg-slate-100/70 border border-slate-200 pl-9 pr-16 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
              />
              <span className="absolute right-2.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-mono font-medium text-slate-500 shadow-xs">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/alerts"
              aria-label="View alerts"
              className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-all hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 shadow-xs"
            >
              <Bell size={18} />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white ring-2 ring-white">
                  {unreadAlertCount}
                </span>
              )}
            </Link>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  aria-label="Account and user details"
                  className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-800 hover:border-emerald-300 hover:bg-slate-50 shadow-xs transition-all cursor-pointer group"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-xs font-extrabold text-white shadow-xs">
                    {userInitial}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-800 group-hover:text-emerald-700 text-xs leading-tight">
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
                  className="rounded-full border border-slate-200 bg-white hover:bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
                  title="Sign out of FarmOps AI"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                aria-label="Log in to FarmOps AI"
                className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-xs font-medium text-slate-800 hover:border-emerald-300 hover:bg-slate-50 shadow-xs transition-all cursor-pointer"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-xs font-extrabold text-white">
                  D
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-slate-800 text-xs leading-tight">
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
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setOpen(false)}
          />
          <aside className="relative h-full w-[280px] bg-white border-r border-slate-200 px-4 py-6 shadow-2xl">
            <div className="mb-9 flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <Logo />
                <span className="text-lg font-bold text-slate-900">FarmOps AI</span>
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-slate-100 text-slate-500"
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
