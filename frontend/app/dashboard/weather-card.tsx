"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CloudSun,
  Sun,
  CloudRain,
  CloudLightning,
  CloudFog,
  Droplets,
  Wind,
  CloudDrizzle,
  MapPin,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { getLiveWeather, type LiveWeatherData } from "../../lib/api/weather";

export function WeatherCard() {
  const [weather, setWeather] = useState<LiveWeatherData>({
    temperature: 28,
    humidity: 62,
    windSpeed: 12,
    rainChance: 10,
    condition: "Partly Cloudy",
    weatherCode: 2,
    locationName: "Ahmedabad, Gujarat",
    lastUpdated: "Just now",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let lat = 23.0225;
    let lng = 72.5714;
    let loc = "Ahmedabad, Gujarat";

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("farmops_custom_farm");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.latitude && parsed.longitude) {
            lat = parsed.latitude;
            lng = parsed.longitude;
            loc = parsed.location || loc;
          }
        } catch {}
      }
    }

    getLiveWeather(lat, lng, loc)
      .then((data) => {
        if (mounted) {
          setWeather(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Choose icon based on weatherCode
  const getWeatherIcon = (code: number) => {
    if (code === 0 || code === 1) {
      return <Sun size={38} className="text-amber-500 animate-spin-slow" />;
    }
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
      return <CloudRain size={38} className="text-blue-500" />;
    }
    if ([95, 96, 99].includes(code)) {
      return <CloudLightning size={38} className="text-amber-600" />;
    }
    if ([45, 48].includes(code)) {
      return <CloudFog size={38} className="text-slate-400" />;
    }
    return <CloudSun size={38} className="text-amber-500" />;
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Weather (Current)
            </h3>
            {weather.source && (
              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                {weather.source}
              </span>
            )}
          </div>
          <Link
            href="/farm"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>View Forecast</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
          <MapPin size={13} className="text-emerald-600 shrink-0" />
          <span>{weather.locationName}</span>
        </p>

        {/* Main Temperature Display */}
        <div className="mt-4 flex items-center gap-4">
          <div className="p-2.5 rounded-2xl bg-amber-50/80 shrink-0">
            {getWeatherIcon(weather.weatherCode)}
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {weather.temperature}°C
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              {weather.condition}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Detail Metric Columns */}
      <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Droplets size={12} className="text-blue-500" />
            <span>Humidity</span>
          </span>
          <span className="mt-1 text-xs font-extrabold text-slate-900">
            {weather.humidity}%
          </span>
        </div>

        <div className="flex flex-col items-center border-l border-slate-100">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Wind size={12} className="text-teal-600" />
            <span>Wind</span>
          </span>
          <span className="mt-1 text-xs font-extrabold text-slate-900">
            {weather.windSpeed} km/h
          </span>
        </div>

        <div className="flex flex-col items-center border-l border-slate-100">
          <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <CloudDrizzle size={12} className="text-indigo-500" />
            <span>Rain Chance</span>
          </span>
          <span className="mt-1 text-xs font-extrabold text-slate-900">
            {weather.rainChance}%
          </span>
        </div>
      </div>
    </div>
  );
}
