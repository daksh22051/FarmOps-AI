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

  const inputStyle = "w-full rounded-xl bg-slate-50 border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-fade-in text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
              <KeyRound size={16} />
            </span>
            <h3 id="auth-modal-title" className="text-base font-bold text-slate-900">
              {currentUser ? "Account & Farm Context" : isSignUp ? "Create FarmOps Account" : "Sign In to FarmOps AI"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Authenticated State */}
        {currentUser ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 font-extrabold text-white text-base shadow-md shadow-emerald-600/20">
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
                  <p className="text-[11px] text-emerald-700 capitalize font-medium mt-0.5">
                    Role: <span className="font-semibold text-emerald-800">{currentUser.role}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Farm Switcher */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Accessible Farms ({backendFarms.length})
              </label>
              {backendFarms.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No farms registered under this account.</p>
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
                        className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs text-left transition-all border ${
                          isSelected
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Building2 size={14} className={isSelected ? "text-emerald-600" : "text-slate-400"} />
                          <span className="truncate">{f.name}</span>
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-800 font-bold">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition-colors"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* Sign In / Sign Up Form */
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Connect to the live FastAPI backend with your Supabase credentials to access farm data.
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
                  suppressHydrationWarning
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@farmops.ai"
                  className={inputStyle}
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
                  suppressHydrationWarning
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-500 hover:to-emerald-400 transition-all disabled:opacity-50"
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
                className="text-xs text-emerald-700 hover:text-emerald-900 hover:underline font-semibold transition"
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
