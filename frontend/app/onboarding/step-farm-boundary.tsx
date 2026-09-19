"use client";

import React, { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  MapPin,
  Pencil,
  Sparkles,
  HelpCircle,
  Compass,
} from "lucide-react";
import type { GeoPoint, RealMapData } from "../../components/map/real-satellite-map";

// Dynamically import RealSatelliteMap to prevent SSR leaflet errors
const RealSatelliteMap = dynamic(
  () => import("../../components/map/real-satellite-map").then((m) => m.RealSatelliteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[460px] w-full rounded-3xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center animate-pulse">
          <Compass size={22} className="animate-spin" />
        </div>
        <div className="text-xs font-bold text-slate-300">
          Loading Esri High-Resolution Satellite Map...
        </div>
        <div className="text-[10px] text-slate-500">
          Connecting to GIS satellite telemetry layer
        </div>
      </div>
    ),
  }
);

export interface Point {
  x: number;
  y: number;
}

export interface FarmBoundaryData {
  locationName: string;
  latitude: number;
  longitude: number;
  farmPin?: Point | null;
  geoFarmPin?: GeoPoint | null;
  geoBoundaryPoints?: GeoPoint[];
  points: Point[];
  areaHectares: number;
  areaAcres: number;
  perimeterKm: number;
  isClosed: boolean;
}

interface StepFarmBoundaryProps {
  farmPhotoUrl?: string | null;
  farmName?: string;
  data: FarmBoundaryData;
  onChange: (data: Partial<FarmBoundaryData>) => void;
  onNext: () => void;
  onBack: () => void;
}

// Convert GeoPoints [lat, lng] to normalized SVG canvas points for Step 4 zone slicing
export function normalizeGeoPointsToSvg(geoPoints: GeoPoint[]): Point[] {
  if (geoPoints.length === 0) return [];
  if (geoPoints.length < 3) {
    return geoPoints.map((p, idx) => ({ x: 200 + idx * 100, y: 200 }));
  }

  const minLat = Math.min(...geoPoints.map((p) => p.lat));
  const maxLat = Math.max(...geoPoints.map((p) => p.lat));
  const minLng = Math.min(...geoPoints.map((p) => p.lng));
  const maxLng = Math.max(...geoPoints.map((p) => p.lng));

  const dLat = maxLat - minLat || 0.0005;
  const dLng = maxLng - minLng || 0.0005;

  return geoPoints.map((p) => ({
    x: Math.round(180 + ((p.lng - minLng) / dLng) * 440),
    y: Math.round(390 - ((p.lat - minLat) / dLat) * 280),
  }));
}

export function StepFarmBoundary({
  farmPhotoUrl,
  farmName = "My Farm",
  data,
  onChange,
  onNext,
  onBack,
}: StepFarmBoundaryProps) {
  // Format data for RealSatelliteMap
  const mapData: RealMapData = {
    farmPin: data.geoFarmPin || (data.latitude && data.longitude ? { lat: data.latitude, lng: data.longitude } : null),
    boundaryPoints: data.geoBoundaryPoints || [],
    areaHectares: data.areaHectares || 0,
    areaAcres: data.areaAcres || 0,
    perimeterKm: data.perimeterKm || 0,
    latitude: data.latitude || 23.0225,
    longitude: data.longitude || 72.5714,
    locationName: data.locationName || "Ahmedabad, Gujarat",
  };

  const handleMapChange = (updated: Partial<RealMapData>) => {
    const nextGeoPoints = updated.boundaryPoints !== undefined ? updated.boundaryPoints : (data.geoBoundaryPoints || []);
    const normalizedSvgPoints = normalizeGeoPointsToSvg(nextGeoPoints);
    const { farmPin, ...rest } = updated;

    onChange({
      ...rest,
      geoBoundaryPoints: nextGeoPoints,
      geoFarmPin: farmPin !== undefined ? farmPin : data.geoFarmPin,
      points: normalizedSvgPoints.length >= 3 ? normalizedSvgPoints : data.points,
      isClosed: nextGeoPoints.length >= 3,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-2xs">
          <Compass size={14} className="text-emerald-600" />
          <span>Step 3 of 5 • Real GIS Satellite Boundary</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Select Location & Draw Boundary 🗺️
        </h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Use the interactive high-resolution satellite map to pinpoint your farm in India, then draw your field boundary to calculate real geodesic acreage.
        </p>
      </div>

      {/* Main Grid: Real Satellite Map & Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Real Satellite Map Component (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
            <RealSatelliteMap
              data={mapData}
              onChange={handleMapChange}
              height="480px"
            />
          </div>
        </div>

        {/* Right Column: Calculations, Photo Thumbnail & Actions (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            {/* Farm Photo Mini-Card (if attached) */}
            {farmPhotoUrl && (
              <div className="relative h-28 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-2xs">
                <Image
                  src={farmPhotoUrl}
                  alt={farmName}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-white">
                  <span className="text-xs font-black truncate">{farmName}</span>
                  <span className="text-[10px] font-bold text-emerald-400">Verified Photo Attached</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  GIS Geodesic Telemetry
                </h3>
                <p className="text-[11px] text-slate-500">
                  Computed via spherical polygon geodesy
                </p>
              </div>
            </div>

            {/* 1. Real Calculated Farm Area */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Calculated Farm Area
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {data.areaHectares} Ha
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  ({data.areaAcres} Acres)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                WGS84 ellipsoidal surface measurement
              </p>
            </div>

            {/* 2. Real Center Coordinates */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Selected GPS Coordinates
              </span>
              <div className="text-xs font-extrabold text-slate-900 font-mono">
                {data.latitude ? `${data.latitude.toFixed(4)}° N, ${data.longitude.toFixed(4)}° E` : "Pin a location"}
              </div>
              <p className="text-[10px] text-slate-400">
                {data.locationName || "India Geographic Coordinate"}
              </p>
            </div>

            {/* 3. Perimeter & Vertices */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Perimeter
                </span>
                <span className="text-sm font-extrabold text-slate-800">
                  {data.perimeterKm} km
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Vertices
                </span>
                <span className="text-sm font-extrabold text-slate-800">
                  {data.geoBoundaryPoints?.length || data.points.length} Points
                </span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 flex items-start gap-1.5">
              <HelpCircle size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <span>
                Use <strong>&quot;1. Pin Center&quot;</strong> to drop your farm pin or <strong>&quot;2. Draw Boundary&quot;</strong> to outline your field directly on the satellite tiles.
              </span>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm transition-all cursor-pointer"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={(data.geoBoundaryPoints?.length || data.points.length) < 3}
              className="flex-1 py-3 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Add / Create Zones</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
