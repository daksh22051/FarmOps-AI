"use client";

import React, { useState } from "react";
import Image from "next/image";
import { User, Phone, Sparkles, Camera, X } from "lucide-react";

export interface FarmerProfileData {
  fullName: string;
  phone: string;
  role: "owner" | "manager" | "agronomist" | "operator";
  profilePhoto?: string | null;
}

interface StepWelcomeProfileProps {
  data: FarmerProfileData;
  onChange: (data: Partial<FarmerProfileData>) => void;
  onNext: () => void;
}

export function StepWelcomeProfile({ data, onChange, onNext }: StepWelcomeProfileProps) {
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handlePhoneChange = (val: string) => {
    // Only allow digits
    const clean = val.replace(/\D/g, "").slice(0, 10);
    onChange({ phone: clean });
    if (clean.length > 0 && clean.length !== 10) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
    } else {
      setPhoneError(null);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onChange({ profilePhoto: result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.fullName.trim()) return;
    if (data.phone && data.phone.trim().length !== 10) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
      return;
    }
    onNext();
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Sparkles size={14} className="text-emerald-600" />
          <span>Step 1 of 6 • Farmer Profile</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Let&apos;s set up your farm 🌱
        </h1>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Tell us a little about yourself and your farming operation.
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
        {/* Profile Photo (Optional) */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="relative group">
            {data.profilePhoto ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-500 shadow-sm">
                <Image
                  src={data.profilePhoto}
                  alt="Profile"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => onChange({ profilePhoto: null })}
                  className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove Photo"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-600 transition-all cursor-pointer shadow-2xs"
              >
                <Camera size={22} />
                <span className="text-[10px] font-bold mt-1">Photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {data.profilePhoto ? "Click photo to remove" : "Optional profile photo"}
          </span>
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <User size={18} />
            </div>
            <input
              type="text"
              required
              value={data.fullName}
              onChange={(e) => onChange({ fullName: e.target.value })}
              placeholder="Enter your full name"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Phone Number <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 select-none">
              🇮🇳 +91
            </span>
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone size={17} />
              </div>
              <input
                type="tel"
                required
                value={data.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Enter 10-digit mobile number"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  phoneError
                    ? "border-rose-300 focus:ring-rose-500 focus:border-rose-500"
                    : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                }`}
              />
            </div>
          </div>
          {phoneError && (
            <p className="text-xs text-rose-600 font-semibold">{phoneError}</p>
          )}
        </div>

        {/* Submit / Continue Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!data.fullName.trim() || data.phone.length !== 10}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue →</span>
          </button>
        </div>
      </form>
    </div>
  );
}
