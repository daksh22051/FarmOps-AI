"use client";

import React, { useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useFarm } from "../context/farm-context";
import { X, LogIn, LogOut, CheckCircle2, AlertCircle, Building2, KeyRound, Mail, Loader2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const {
    currentUser,
    backendFarms,
    selectedFarmId,
    selectFarm,
    logout,
    refreshFarms,
  } = useFarm();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          setSuccessMsg("Account created and signed in!");
          await refreshFarms();
          setTimeout(() => onClose(), 1200);
        } else {
          setSuccessMsg("Account created! Please check your email to confirm registration.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          setSuccessMsg("Successfully signed in!");
          await refreshFarms();
          setTimeout(() => onClose(), 800);
        }
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const msg = err instanceof Error ? err.message : "Authentication request failed";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await logout();
      onClose();
    } catch (err: unknown) {
      console.error("Sign out error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#dfe6dd] bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-forest-100 text-forest-700">
              <KeyRound size={16} />
            </span>
            <h3 id="auth-modal-title" className="text-base font-bold text-ink">
              {currentUser ? "Account & Farm Context" : isSignUp ? "Create FarmOps Account" : "Sign In to FarmOps AI"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Authenticated State */}
        {currentUser ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#1b7340] to-emerald-600 font-extrabold text-white text-base shadow-sm">
                  {(() => {
                    const meta = currentUser.user_metadata || {};
                    const name = (meta.full_name as string) || (meta.name as string) || currentUser.email || "U";
                    return name.trim()[0]?.toUpperCase() || "👤";
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {(() => {
                      const meta = currentUser.user_metadata || {};
                      if (typeof meta.full_name === "string" && meta.full_name.trim()) return meta.full_name.trim();
                      if (typeof meta.name === "string" && meta.name.trim()) return meta.name.trim();
                      if (currentUser.email) {
                        return currentUser.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      }
                      return "Authenticated Operator";
                    })()}
                  </p>
                  <p className="truncate text-xs text-slate-500">{currentUser.email}</p>
                  <p className="text-[11px] text-emerald-800 capitalize font-medium mt-0.5">
                    Role: <span className="font-semibold text-emerald-900">{currentUser.role}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Farm Switcher in Auth Dialog */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Accessible Farms ({backendFarms.length})
              </label>
              {backendFarms.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No operational farms registered under this account.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {backendFarms.map((f) => {
                    const isSelected = f.id === selectedFarmId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={async () => {
                          await selectFarm(f.id);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs text-left transition-colors border ${
                          isSelected
                            ? "border-forest-600 bg-forest-50 text-forest-900 font-semibold"
                            : "border-[#dfe6dd] bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Building2 size={14} className={isSelected ? "text-forest-700" : "text-slate-400"} />
                          <span className="truncate">{f.name}</span>
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-forest-200/60 px-2 py-0.5 text-[10px] text-forest-800 font-bold">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-[#edf0eb] pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Connect to the live FastAPI backend with your Supabase credentials to access authoritative farm and zone data.
            </p>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail size={15} />
                </span>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@farmops.ai"
                  className="w-full rounded-xl border border-[#dfe6dd] bg-white py-2 pl-9 pr-3 text-xs text-ink placeholder:text-slate-400 focus:border-forest-600 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <KeyRound size={15} />
                </span>
                <input
                  id="auth-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-[#dfe6dd] bg-white py-2 pl-9 pr-3 text-xs text-ink placeholder:text-slate-400 focus:border-forest-600 focus:outline-none focus:ring-1 focus:ring-forest-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-forest-800 transition-colors shadow-2xs disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              {isSignUp ? "Register Account" : "Sign In"}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-forest-700 hover:underline font-medium"
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Register with email"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
