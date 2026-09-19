"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "./navigation";
import { useFarm } from "../context/farm-context";
import { AuthModal } from "./auth-modal";

function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border border-forest-100 bg-white shadow-sm ring-1 ring-forest-700/10 ${className}`}>
      <Image
        src="/logo.png"
        alt="FarmOps AI Logo"
        width={48}
        height={48}
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
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={close}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-forest-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-forest-50 hover:text-forest-800"
            }`}
          >
            <Icon aria-hidden="true" size={19} />
            <span>{label}</span>
            {label === "Alerts" && unreadAlertCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                {unreadAlertCount}
              </span>
            )}
            {active && label !== "Alerts" && (
              <ChevronRight aria-hidden="true" className="ml-auto" size={16} />
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

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[250px_1fr]">
      {/* Sidebar for Desktop */}
      <aside className="hidden border-r border-[#e0e6de] bg-white px-4 py-6 lg:block">
        <div className="mb-9 flex items-center gap-3 px-2">
          <Logo />
          <div>
            <span className="text-lg font-bold tracking-tight text-ink block leading-none">
              FarmOps AI
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-forest-700">
              Advisory System
            </span>
          </div>
        </div>

        <Navigation />

        <div className="mt-8 rounded-xl border border-[#dfe6dd] bg-[#f5f7f3] p-4 text-xs leading-5 text-slate-600">
          <strong className="block text-ink font-semibold mb-1">
            {currentUser ? "Live Backend Mode" : "Advisory Console"}
          </strong>
          {currentUser
            ? `Connected as ${currentUser.email || "Operator"}. Authoritative farm & zone data is synced with FastAPI backend.`
            : "State is maintained in workspace. Connect Supabase credentials to access live operational backend."}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#e0e6de] bg-[#f7f7f3]/95 px-4 backdrop-blur sm:px-7 lg:px-9">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-slate-700 hover:bg-white lg:hidden"
            >
              <Menu size={22} />
            </button>
            <span className="text-base font-semibold text-ink sm:text-lg">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/alerts"
              aria-label="View alerts"
              className="relative rounded-full border border-[#dce4dc] bg-white p-2 text-slate-600 transition-colors hover:text-forest-700"
            >
              <Bell size={19} />
              {unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadAlertCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              aria-label={currentUser ? "Account and farm details" : "Connect live backend"}
              className="flex items-center gap-2 rounded-full border border-[#dfe6dd] bg-white py-1 pl-1.5 pr-3 text-xs font-medium text-slate-700 shadow-2xs hover:border-forest-400 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#dcebdd] text-xs font-bold text-forest-800">
                {currentUser ? (currentUser.email?.[0] || "U").toUpperCase() : farm.isDemoData ? "D" : "F"}
              </span>
              <span className="hidden sm:inline font-semibold">
                {currentUser ? farm.name : farm.isDemoData ? "Demo Account" : farm.name}
              </span>
              {!currentUser && (
                <span className="ml-1 rounded-full bg-forest-100 px-2 py-0.5 text-[10px] font-bold text-forest-800">
                  Connect
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-7 lg:px-9 lg:py-10">
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
