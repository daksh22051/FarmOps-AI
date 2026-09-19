"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { useFarm } from "../../context/farm-context";
import { getFarms } from "../../lib/api/farmops";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Leaf,
  ShieldCheck,
  UserPlus,
  LogIn,
  Mail,
  User,
} from "lucide-react";

export interface LoginViewProps {
  initialMode?: "login" | "signup";
}

function LoginForm({ initialMode }: LoginViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, refreshFarms } = useFarm();

  const modeParam = searchParams.get("mode") || searchParams.get("tab");
  const defaultIsSignUp = initialMode === "signup" || modeParam === "signup";

  const [isSignUp, setIsSignUp] = useState(defaultIsSignUp);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [suggestSignUp, setSuggestSignUp] = useState(false);
  const [suggestLogIn, setSuggestLogIn] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync mode if query param changes
  useEffect(() => {
    if (modeParam === "signup") {
      setIsSignUp(true);
    } else if (modeParam === "login") {
      setIsSignUp(false);
    }
  }, [modeParam]);

  // If already authenticated, check if farm exists: redirect to /dashboard or /onboarding
  useEffect(() => {
    if (currentUser) {
      setSuccessMessage(`Signed in as ${currentUser.email}. Checking farm status...`);
      const timer = setTimeout(async () => {
        try {
          const farmsRes = await getFarms();
          if (farmsRes.data && farmsRes.data.length > 0) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
        } catch {
          router.push("/onboarding");
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentUser, router]);

  // Quick Send Reset Link helper
  const handleSendResetLink = async () => {
    if (!email.trim()) {
      setErrorMessage("Please enter your email address to reset password.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = createClient();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setSuccessMessage(`Password reset link sent to ${email}! Please check your email inbox.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send reset link.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle direct sign-up using the currently typed credentials
  const handleDirectSignUp = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuggestSignUp(false);
    setSuggestLogIn(false);

    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim() || email.split("@")[0],
          },
        },
      });

      if (error) {
        const errorText = error.message.toLowerCase();
        if (errorText.includes("already registered") || errorText.includes("already exists")) {
          setIsSignUp(false);
          setSuggestLogIn(true);
          setErrorMessage(`An account for "${email}" already exists! Please enter your password to log in, or click "Forgot password?" to reset it.`);
          return;
        }
        throw error;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setSuggestLogIn(true);
        setErrorMessage(`An account for "${email}" already exists! Please enter your password to log in, or click "Forgot password?" to reset it.`);
        setIsSignUp(false);
        return;
      }

      if (data.session) {
        setSuccessMessage("Account created successfully! Preparing your farm setup...");
        try {
          const farmsRes = await getFarms();
          if (farmsRes.data && farmsRes.data.length > 0) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
        } catch {
          router.push("/onboarding");
        }
      } else {
        setEmailConfirmationRequired(true);
        setSuccessMessage(`Account created for ${email}! Please check your email inbox to confirm registration.`);
      }
    } catch (err: unknown) {
      console.error("Sign up error:", err);
      let msg = err instanceof Error ? err.message : "Failed to create account.";
      if (msg.toLowerCase().includes("rate limit")) {
        setIsRateLimited(true);
        msg = "Supabase email rate limit exceeded (free-tier limit: ~3 confirmation emails/hr). You can switch to Log In or enter immediately via Demo Access below.";
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle standard submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setSuggestSignUp(false);
    setSuggestLogIn(false);
    setIsRateLimited(false);
    setEmailConfirmationRequired(false);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isForgotPassword) {
        if (!email.trim()) {
          throw new Error("Please enter your email address to reset password.");
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        setSuccessMessage("Password reset link sent! Please check your email inbox.");
      } else if (isSignUp) {
        // Sign Up Flow
        if (!email.trim() || !password) {
          throw new Error("Please fill in both email and password.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined,
            },
          },
        });

        if (error) {
          const errorText = error.message.toLowerCase();
          if (errorText.includes("already registered") || errorText.includes("already exists")) {
            setIsSignUp(false);
            setSuggestLogIn(true);
            setErrorMessage(`An account for "${email}" already exists! Please enter your password to log in, or click "Forgot password?" to reset it.`);
            return;
          }
          throw error;
        }

        // Check if user already exists
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setSuggestLogIn(true);
          setErrorMessage(`An account for "${email}" already exists! Please enter your password to log in, or click "Forgot password?" to reset it.`);
          setIsSignUp(false);
          return;
        }

        if (data.session) {
          setSuccessMessage("Account created successfully! Welcome to FarmOps...");
          try {
            await refreshFarms();
          } catch {
            // Backend may be starting up; onboarding will load data when ready
          }
          router.push("/onboarding");
        } else {
          setEmailConfirmationRequired(true);
          setSuccessMessage(`Account created! Please check your email (${email}) to confirm your registration.`);
        }
      } else {
        // Log In Flow
        if (!email.trim() || !password) {
          throw new Error("Please enter both email and password.");
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const errorText = error.message.toLowerCase();
          if (errorText.includes("email not confirmed")) {
            setEmailConfirmationRequired(true);
            setErrorMessage(`Your account has been registered, but your email (${email}) has not been confirmed yet. Please check your inbox or explore in Demo Mode.`);
            return;
          }
          if (errorText.includes("invalid login credentials")) {
            setSuggestSignUp(true);
            setErrorMessage(`Incorrect password or no account found for "${email}". If this is your account, please check your password or click "Forgot password?".`);
            return;
          }
          throw error;
        }

        if (data.session) {
          setSuccessMessage("Welcome back! Loading your farm...");
          try {
            await refreshFarms();
            const farmsRes = await getFarms();
            if (farmsRes.data && farmsRes.data.length > 0) {
              router.push("/dashboard");
            } else {
              router.push("/onboarding");
            }
          } catch {
            router.push("/onboarding");
          }
        }
      }
    } catch (err: unknown) {
      console.error("Auth submit error:", err);
      let msg = err instanceof Error ? err.message : "Authentication failed. Please check your credentials.";
      if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("email rate limit exceeded")) {
        setIsRateLimited(true);
        msg = "Supabase email rate limit exceeded (free-tier limit: ~3 confirmation emails/hr). You can switch to Log In or enter immediately via Demo Access below.";
      } else if (msg.includes("Failed to fetch")) {
        msg = "Unable to connect to authentication service. Please check your internet connection and verify that the backend is reachable.";
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle OAuth provider login
  const handleSocialLogin = async (provider: "google" | "azure") => {
    setErrorMessage(null);
    setSocialLoading(provider);

    const supabase = createClient();

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      console.error("OAuth error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : `${provider === "google" ? "Google" : "Microsoft"} login is not configured or failed.`;
      setErrorMessage(msg);
      setSocialLoading(null);
    }
  };

  // 1-Click Instant Demo Login
  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "demo@farmops.ai",
        password: "FarmOpsDemoPassword123!",
      });

      if (!error && data.session) {
        setSuccessMessage("Demo session activated! Redirecting to dashboard...");
        try {
          await refreshFarms();
        } catch {
          // Backend may be starting up; dashboard will load data when ready
        }
        router.push("/dashboard");
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: "demo@farmops.ai",
        password: "FarmOpsDemoPassword123!",
        options: {
          data: { full_name: "Demo Agronomist" },
        },
      });

      if (!signUpError && signUpData.session) {
        setSuccessMessage("Demo account created! Redirecting to dashboard...");
        try {
          await refreshFarms();
        } catch {
          // Backend may be starting up; dashboard will load data when ready
        }
        router.push("/dashboard");
        return;
      }

      // Fallback: direct dashboard navigation
      setSuccessMessage("Connecting demo session in workspace mode...");
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#fcfdfc] text-slate-800 antialiased selection:bg-emerald-200 selection:text-emerald-900">
      {/* ============================================================ */}
      {/* LEFT PANEL: Hero / Brand Visual Side                         */}
      {/* ============================================================ */}
      <div className="relative w-full lg:w-1/2 min-h-[500px] lg:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden bg-forest-950">
        {/* Background Image with Cinematic Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/farm_login_bg.jpg"
            alt="FarmOps agricultural terraces at sunrise"
            fill
            priority
            className="object-cover object-center transform scale-105 transition-transform duration-1000 ease-out"
          />
          {/* Rich Vignette Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
          <div className="absolute inset-0 bg-emerald-950/20 mix-blend-multiply" />
        </div>

        {/* Top Brand Logo & Title */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden border-2 border-white/60 shadow-xl bg-white/20 backdrop-blur-xs shrink-0">
            <Image
              src="/logo.png"
              alt="FarmOps AI Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                FarmOps
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-400 drop-shadow-sm">
                AI
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-emerald-100/90 tracking-wide drop-shadow-xs">
              Smarter Farms. Brighter Tomorrows.
            </p>
          </div>
        </div>

        {/* Center Main Headline & Value Proposition */}
        <div className="relative z-10 my-auto py-12 lg:py-0">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-extrabold text-white tracking-tight leading-[1.12] drop-shadow-md">
            Sustainable
            <br />
            Farming, Smarter
            <br />
            <span className="text-emerald-400">Decisions.</span>
          </h1>

          <p className="mt-5 sm:mt-6 text-sm sm:text-base lg:text-lg leading-relaxed text-slate-100/95 max-w-xl font-normal drop-shadow-xs">
            Real-time insights, AI-powered recommendations and tools to help farmers grow more, waste less and build a brighter tomorrow.
          </p>

          <div className="mt-7 flex items-center gap-2.5">
            <span className="h-1 w-8 rounded-full bg-emerald-400" />
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
              For a greener tomorrow
            </span>
          </div>
        </div>

        {/* Bottom Three Pillars */}
        <div className="relative z-10 pt-6 border-t border-white/25">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            <div>
              <p className="text-sm sm:text-base font-bold text-white tracking-tight">
                Healthy
              </p>
              <p className="text-xs sm:text-sm text-emerald-200/90 font-medium">
                Crops
              </p>
            </div>
            <div className="border-l border-white/20 pl-3 sm:pl-6">
              <p className="text-sm sm:text-base font-bold text-white tracking-tight">
                Stronger
              </p>
              <p className="text-xs sm:text-sm text-emerald-200/90 font-medium">
                Communities
              </p>
            </div>
            <div className="border-l border-white/20 pl-3 sm:pl-6">
              <p className="text-sm sm:text-base font-bold text-white tracking-tight">
                Brighter
              </p>
              <p className="text-xs sm:text-sm text-emerald-200/90 font-medium">
                Futures
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RIGHT PANEL: Form & Authentication Controls                  */}
      {/* ============================================================ */}
      <div className="relative w-full lg:w-1/2 min-h-[600px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white overflow-hidden">
        {/* Subtle Decorative Background Wave Pattern */}
        <div
          className="absolute -bottom-16 -right-16 w-96 h-96 pointer-events-none opacity-40"
          aria-hidden="true"
        >
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 400C120 380 220 320 280 240C340 160 380 80 400 0V400H0Z"
              fill="url(#greenGradient)"
            />
            <defs>
              <linearGradient id="greenGradient" x1="0" y1="200" x2="400" y2="400" gradientUnits="userSpaceOnUse">
                <stop stopColor="#10b981" stopOpacity="0.18" />
                <stop stopColor="#059669" stopOpacity="0.05" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Top Header: Toggle between Log In & Sign Up */}
        <div className="relative z-10 flex items-center justify-end gap-3 text-xs sm:text-sm">
          <span className="text-slate-500">
            {isSignUp
              ? "Already have an account?"
              : isForgotPassword
              ? "Remember your password?"
              : "Don't have an account?"}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setIsForgotPassword(false);
              setSuggestSignUp(false);
              setSuggestLogIn(false);
              setEmailConfirmationRequired(false);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="rounded-xl border border-emerald-700/80 bg-white px-4 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors shadow-2xs"
          >
            {isSignUp || isForgotPassword ? "Log In" : "Sign Up"}
          </button>
        </div>

        {/* Center Main Form Card */}
        <div className="relative z-10 my-auto w-full max-w-md mx-auto py-8">
          {/* Prominent Tab Switcher (Log In vs Sign Up) */}
          <div className="mb-6 flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setIsForgotPassword(false);
                setSuggestSignUp(false);
                setSuggestLogIn(false);
                setEmailConfirmationRequired(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                !isSignUp && !isForgotPassword
                  ? "bg-[#1b7340] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LogIn size={14} />
              <span>Log In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setIsForgotPassword(false);
                setSuggestSignUp(false);
                setSuggestLogIn(false);
                setEmailConfirmationRequired(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                isSignUp
                  ? "bg-[#1b7340] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserPlus size={14} />
              <span>Sign Up (New User)</span>
            </button>
          </div>

          <div className="mb-7">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {isForgotPassword
                ? "Reset Password"
                : isSignUp
                ? "Create an Account"
                : "Welcome Back"}
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {isForgotPassword
                ? "Enter your email address and we will send you instructions to reset your password."
                : isSignUp
                ? "Enter your details to create your farm management account."
                : "Log in to continue to your farm dashboard."}
            </p>
          </div>

          {/* Email Confirmation Required Screen */}
          {emailConfirmationRequired ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-5 text-emerald-950 space-y-3 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-emerald-950">
                    Registration Link Sent!
                  </h3>
                  <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                    We sent a confirmation link to <strong>{email}</strong>. Please check your email inbox and click the link to activate your account.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-emerald-200/80 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1b7340] hover:bg-[#145d33] py-2.5 px-4 text-xs font-bold text-white shadow-sm transition-all"
                >
                  <Sparkles size={14} />
                  <span>Explore Dashboard in Demo Mode While Waiting →</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setEmailConfirmationRequired(false);
                    setSuccessMessage(null);
                  }}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline text-center pt-1"
                >
                  Back to Log In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Feedback Banners */}
              {errorMessage && (
                <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-950 flex flex-col gap-2.5 shadow-2xs animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-amber-900">
                        {suggestSignUp ? "First-time user? Account not created yet" : "Authentication Notice"}
                      </p>
                      <p className="mt-0.5 text-amber-800 leading-relaxed">
                        {errorMessage}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Instant Sign Up Action when user is not registered */}
                  {suggestSignUp && (
                    <div className="mt-2 pt-3 border-t border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <span className="text-xs font-semibold text-amber-900">
                        Create your account now with this email:
                      </span>
                      <button
                        type="button"
                        onClick={handleDirectSignUp}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1b7340] hover:bg-[#145d33] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                      >
                        {loading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <UserPlus size={13} />
                        )}
                        <span>Sign Up with {email.split("@")[0] || "Email"} →</span>
                      </button>
                    </div>
                  )}

                  {/* 1-Click Switch to Log In if account already exists */}
                  {suggestLogIn && (
                    <div className="mt-2 pt-3 border-t border-amber-200 flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                        <span className="text-xs font-semibold text-amber-900">
                          Already have an account?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignUp(false);
                            setSuggestLogIn(false);
                            setErrorMessage(null);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1b7340] hover:bg-[#145d33] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                        >
                          <LogIn size={13} />
                          <span>Log In with Password →</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-amber-200/60">
                        <span className="text-[11px] text-amber-800">Forgot your password?</span>
                        <button
                          type="button"
                          onClick={handleSendResetLink}
                          disabled={loading}
                          className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                        >
                          Send Password Reset Link to {email} →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1-Click Action when rate-limited */}
                  {isRateLimited && (
                    <div className="mt-2 pt-3 border-t border-amber-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                      <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={demoLoading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1b7340] hover:bg-[#145d33] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                      >
                        {demoLoading ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        <span>⚡ Enter Dashboard via Demo Access →</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignUp(false);
                          setIsRateLimited(false);
                          setErrorMessage(null);
                        }}
                        className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline text-center cursor-pointer"
                      >
                        Switch to Log In Tab
                      </button>
                    </div>
                  )}
                </div>
              )}

              {successMessage && !emailConfirmationRequired && (
                <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs font-semibold text-emerald-900 flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200">
                  <CheckCircle2 size={17} className="text-emerald-600 mt-0.5 shrink-0" />
                  <p>{successMessage}</p>
                </div>
              )}

              {/* Main Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name (Sign Up Mode only) */}
                {isSignUp && (
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Full Name (Optional)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User size={16} />
                      </span>
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Daksh Khamar"
                        className="w-full rounded-xl border border-slate-200 bg-[#f9faf8] pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none transition-all shadow-2xs"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail size={16} />
                    </span>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setSuggestSignUp(false);
                      }}
                      placeholder="Enter your email"
                      className="w-full rounded-xl border border-slate-200 bg-[#f9faf8] pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Password Field (Not for Forgot Password) */}
                {!isForgotPassword && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="password"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Password
                      </label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsForgotPassword(true);
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setSuggestSignUp(false);
                          }}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={isSignUp ? "Create a password (min 6 characters)" : "Enter your password"}
                        className="w-full rounded-xl border border-slate-200 bg-[#f9faf8] px-4 py-3 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none transition-all shadow-2xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {isSignUp && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Must be at least 6 characters.
                      </p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 rounded-xl bg-[#1b7340] hover:bg-[#145d33] active:scale-[0.99] text-white py-3.5 px-5 font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : isForgotPassword ? (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  ) : isSignUp ? (
                    <>
                      <span>Create FarmOps Account →</span>
                    </>
                  ) : (
                    <>
                      <span>Log In →</span>
                    </>
                  )}
                </button>
              </form>

              {/* Social Logins */}
              {!isForgotPassword && (
                <div className="mt-6">
                  <div className="relative flex items-center justify-center">
                    <div className="w-full border-t border-slate-200" />
                    <span className="relative bg-white px-3 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                      Or continue with
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {/* Google Sign In */}
                    <button
                      type="button"
                      onClick={() => handleSocialLogin("google")}
                      disabled={socialLoading !== null}
                      className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer disabled:opacity-60"
                    >
                      {socialLoading === "google" ? (
                        <Loader2 size={15} className="animate-spin text-slate-500" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#EA4335"
                            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                          />
                          <path
                            fill="#4285F4"
                            d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.6 14.8c-.3-.8-.4-1.8-.4-2.8 0-1 .2-2 .4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                          />
                        </svg>
                      )}
                      <span>Continue with Google</span>
                    </button>

                    {/* Microsoft Sign In */}
                    <button
                      type="button"
                      onClick={() => handleSocialLogin("azure")}
                      disabled={socialLoading !== null}
                      className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer disabled:opacity-60"
                    >
                      {socialLoading === "azure" ? (
                        <Loader2 size={15} className="animate-spin text-slate-500" />
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
                          <path fill="#f25022" d="M1 1h10v10H1z" />
                          <path fill="#00a4ef" d="M1 12h10v10H1z" />
                          <path fill="#7fba00" d="M12 1h10v10H12z" />
                          <path fill="#ffb900" d="M12 12h10v10H12z" />
                        </svg>
                      )}
                      <span>Continue with Microsoft</span>
                    </button>
                  </div>

                  {/* 1-Click Instant Demo Login */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleDemoLogin}
                      disabled={demoLoading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 py-2.5 px-3 text-xs font-bold text-emerald-800 transition-all shadow-2xs cursor-pointer group"
                    >
                      {demoLoading ? (
                        <Loader2 size={14} className="animate-spin text-emerald-700" />
                      ) : (
                        <Sparkles size={14} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                      )}
                      <span>⚡ Quick Demo Login (Instant Dashboard Access)</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Privacy & Safety Disclosure */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Encrypted with Supabase JWT • Deterministic Safety Guard</span>
          </div>
        </div>

        {/* Bottom Right Footer */}
        <div className="relative z-10 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Leaf size={12} className="fill-current" />
            </div>
            <div className="relative">
              <span>Technology for a healthier tomorrow</span>
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400/80 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginView(props: LoginViewProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-[#fcfdfc]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-emerald-600" />
            <p className="text-xs font-semibold text-slate-500">Loading FarmOps AI...</p>
          </div>
        </div>
      }
    >
      <LoginForm {...props} />
    </Suspense>
  );
}

export default LoginView;
