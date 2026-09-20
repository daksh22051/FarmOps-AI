"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { AppShell } from "../../components/app-shell";
import { Card, PageHeading } from "../../components/ui";
import { useFarm, type FarmZone } from "../../context/farm-context";
import { AuthModal } from "../../components/auth-modal";
import { LiveWeatherCard } from "../dashboard/live-weather-card";
import { ApiClientError } from "../../lib/api/client";
import {
  detectRisks,
  evaluateRiskWithAI,
  createActionPlan,
  approveActionPlan,
  rejectActionPlan,
  createTask as apiCreateTask,
  startTask as apiStartTask,
  completeTask as apiCompleteTask,
} from "../../lib/api/farmops";
import { formatRiskType, getSeverityStyle } from "../../lib/risks";
import type { AIEvaluationResponse, ActionPlan, RiskAssessment, Task as BackendTask, Zone as BackendZone } from "../../types/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CloudSun,
  Cpu,
  Droplets,
  Edit2,
  Eye,
  Info,
  Layers,
  Leaf,
  Loader2,
  MapPin,
  Plus,
  Radio,
  RefreshCw,
  Satellite,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Thermometer,
  Trash2,
  Wind,
  X,
} from "lucide-react";

/* ===== DESIGN TOKENS ===== */
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all duration-200 cursor-pointer";
const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 transition-all duration-200 cursor-pointer";
const inputStyle =
  "w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none transition-all";

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "No data recorded";
  try {
    const timestamp = new Date(isoString).getTime();
    if (!Number.isFinite(timestamp)) return "No data recorded";
    const now = Date.now();
    const diffSec = Math.floor((now - timestamp) / 1000);
    if (diffSec < 45) return "Just now";
    const minutes = Math.floor(diffSec / 60);
    if (minutes <= 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  } catch {
    return "Recently";
  }
}

function formatIST(value?: string | null): string {
  if (!value) return "Not recorded";
  try {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return "Not recorded";
    return (
      d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " IST"
    );
  } catch {
    return value;
  }
}

export default function MyFarmPage() {
  const {
    farm,
    totalAreaHa,
    activeZoneCount,
    updateProfile,
    addZone,
    updateZone,
    deleteZone: deleteLocalZone,
    loadDemoFarm,
    clearFarm,
    formatArea,
    settings,
    currentUser,
    backendFarms,
    selectedFarmId,
    selectedFarm,
    backendZones,
    devices,
    telemetryEvents,
    backendRisks,
    backendTasks,
    isLoadingFarms,
    isLoadingFarm,
    isLoadingZones,
    isLoadingDevices,
    farmError,
    devicesError,
    selectFarm,
    createBackendFarm,
    updateBackendFarm,
    deleteBackendFarm,
    addBackendZone,
    updateBackendZone,
    deleteBackendZone,
    refreshFarms,
    refreshZones,
    refreshDevices,
  } = useFarm();

  // Navigation & Modal States
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit Farm Modal State
  const [editingFarm, setEditingFarm] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [farmAddress, setFarmAddress] = useState("");
  const [farmTotalArea, setFarmTotalArea] = useState("12.5");
  const [farmAreaUnit, setFarmAreaUnit] = useState("acres");
  const [farmSoilType, setFarmSoilType] = useState("Medium Black Clayey Loam");
  const [farmMainCrops, setFarmMainCrops] = useState("Sugarcane, Banana, Cotton");
  const [farmIrrigation, setFarmIrrigation] = useState("Drip");
  const [farmDescription, setFarmDescription] = useState("");
  const [isSavingFarm, setIsSavingFarm] = useState(false);

  // Delete Farm Confirmation State
  const [showDeleteFarmConfirm, setShowDeleteFarmConfirm] = useState(false);
  const [isDeletingFarm, setIsDeletingFarm] = useState(false);

  // Zone Modal State (Add & Edit)
  const [zoneModalMode, setZoneModalMode] = useState<"add" | "edit" | null>(null);
  const [targetZoneId, setTargetZoneId] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneArea, setZoneArea] = useState("4.0");
  const [zoneAreaUnit, setZoneAreaUnit] = useState("acres");
  const [zoneCrop, setZoneCrop] = useState("Sugarcane");
  const [zoneSoil, setZoneSoil] = useState("Clay Loam");
  const [zoneIrrigation, setZoneIrrigation] = useState<"Drip" | "Sprinkler" | "Flood / Furrow" | "Rainfed">("Drip");
  const [zoneStatus, setZoneStatus] = useState<"Active Cultivation" | "Soil Preparation" | "Fallow / Resting">("Active Cultivation");
  const [zoneFormError, setZoneFormError] = useState("");
  const [isSavingZone, setIsSavingZone] = useState(false);

  // Delete Zone Confirmation State
  const [deletingZone, setDeletingZone] = useState<{ id: string; name: string; area: number | null } | null>(null);
  const [isDeletingZone, setIsDeletingZone] = useState(false);

  // Create Task State
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskZoneId, setTaskZoneId] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // AI Advisory Evaluation State
  const [isScanningRisks, setIsScanningRisks] = useState(false);
  const [evaluatingRiskId, setEvaluatingRiskId] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<{ risk: RiskAssessment; result: AIEvaluationResponse } | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Sync state when active farm changes
  useEffect(() => {
    if (selectedFarm) {
      setFarmName(selectedFarm.name || "");
      setFarmLocation(selectedFarm.location || "");
      setFarmAddress(selectedFarm.address || "");
      setFarmTotalArea(selectedFarm.total_area?.toString() || "12.5");
      setFarmAreaUnit(selectedFarm.area_unit || "acres");
      const cropProf = selectedFarm.crop_profile || {};
      setFarmSoilType((cropProf.primary_soil as string) || (cropProf.soil_type as string) || "Medium Black Clayey Loam");
      setFarmMainCrops((cropProf.primary_crop as string) || (cropProf.crops as string) || "Sugarcane, Banana");
      setFarmIrrigation((cropProf.irrigation_type as string) || "Drip");
      setFarmDescription((cropProf.description as string) || "");
    } else {
      setFarmName(farm.name);
      setFarmLocation(farm.district);
      setFarmAddress("");
      setFarmTotalArea(totalAreaHa.toString());
      setFarmAreaUnit(settings.unitSystem === "Imperial" ? "acres" : "hectares");
      setFarmSoilType(farm.primarySoil);
      setFarmMainCrops("Sugarcane, Banana");
      setFarmIrrigation("Drip");
      setFarmDescription("");
    }
  }, [selectedFarm, farm, totalAreaHa, settings.unitSystem]);

  // Open Edit Farm Form
  const openEditFarmModal = () => {
    if (selectedFarm) {
      setFarmName(selectedFarm.name);
      setFarmLocation(selectedFarm.location || "");
      setFarmAddress(selectedFarm.address || "");
      setFarmTotalArea(selectedFarm.total_area?.toString() || "12.5");
      setFarmAreaUnit(selectedFarm.area_unit || "acres");
      const cropProf = selectedFarm.crop_profile || {};
      setFarmSoilType((cropProf.primary_soil as string) || (cropProf.soil_type as string) || "Medium Black Clayey Loam");
      setFarmMainCrops((cropProf.primary_crop as string) || (cropProf.crops as string) || "Sugarcane, Banana");
      setFarmIrrigation((cropProf.irrigation_type as string) || "Drip");
      setFarmDescription((cropProf.description as string) || "");
    } else {
      setFarmName(farm.name);
      setFarmLocation(farm.district);
      setFarmSoilType(farm.primarySoil);
    }
    setEditingFarm(true);
  };

  // Save Farm Form (Backend + Local fallback)
  const handleSaveFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmName.trim()) {
      setErrorMessage("Farm title cannot be empty.");
      return;
    }
    setIsSavingFarm(true);
    setErrorMessage(null);

    const parsedArea = parseFloat(farmTotalArea) || undefined;
    const cropProfileData = {
      primary_soil: farmSoilType.trim(),
      primary_crop: farmMainCrops.trim(),
      irrigation_type: farmIrrigation.trim(),
      description: farmDescription.trim(),
    };

    if (selectedFarm && selectedFarmId) {
      const res = await updateBackendFarm(selectedFarmId, {
        name: farmName.trim(),
        location: farmLocation.trim(),
        address: farmAddress.trim(),
        total_area: parsedArea,
        area_unit: farmAreaUnit,
        crop_profile: cropProfileData,
      });
      setIsSavingFarm(false);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to update farm on backend.");
        return;
      }
      setSuccessNotification(`Farm "${farmName.trim()}" updated successfully.`);
      setTimeout(() => setSuccessNotification(null), 4000);
      setEditingFarm(false);
      return;
    }

    // Local profile update
    updateProfile(farmName, farmLocation, farmSoilType);
    setIsSavingFarm(false);
    setSuccessNotification(`Local farm profile "${farmName.trim()}" updated.`);
    setTimeout(() => setSuccessNotification(null), 3000);
    setEditingFarm(false);
  };

  // Delete Farm
  const handleDeleteFarm = async () => {
    if (!selectedFarmId) {
      clearFarm();
      setShowDeleteFarmConfirm(false);
      setSuccessNotification("Demo farm reset.");
      setTimeout(() => setSuccessNotification(null), 3000);
      return;
    }

    setIsDeletingFarm(true);
    const res = await deleteBackendFarm(selectedFarmId);
    setIsDeletingFarm(false);
    setShowDeleteFarmConfirm(false);
    if (!res.success) {
      setErrorMessage(res.error || "Failed to delete farm.");
      return;
    }
    setSuccessNotification("Farm deleted successfully.");
    setTimeout(() => setSuccessNotification(null), 4000);
  };

  // Open Add Zone Modal
  const openAddZoneModal = () => {
    setZoneModalMode("add");
    setTargetZoneId(null);
    setZoneName("");
    setZoneArea("4.0");
    setZoneAreaUnit(farmAreaUnit || "acres");
    setZoneCrop("Sugarcane");
    setZoneSoil("Medium Black Clay");
    setZoneIrrigation("Drip");
    setZoneStatus("Active Cultivation");
    setZoneFormError("");
  };

  // Open Edit Zone Modal
  const openEditZoneModal = (z: { id: string; name: string; area: number | null; crop?: string; soil?: string; irrigation?: string; status?: string }) => {
    setZoneModalMode("edit");
    setTargetZoneId(z.id);
    setZoneName(z.name);
    // A zone whose area was never recorded opens with an empty field, so the
    // farmer enters the real figure instead of correcting a guessed one.
    setZoneArea(z.area != null ? z.area.toString() : "");
    setZoneAreaUnit(farmAreaUnit || "acres");
    setZoneCrop(z.crop || "Sugarcane");
    setZoneSoil(z.soil || "Medium Black Clay");
    setZoneIrrigation((z.irrigation as "Drip") || "Drip");
    setZoneStatus((z.status as "Active Cultivation") || "Active Cultivation");
    setZoneFormError("");
  };

  // Save Zone Form (Add / Edit)
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setZoneFormError("");
    if (!zoneName.trim()) {
      setZoneFormError("Parcel / Zone name is required.");
      return;
    }
    const parsedArea = parseFloat(zoneArea);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      setZoneFormError("Please enter a valid positive area number.");
      return;
    }

    setIsSavingZone(true);

    if (zoneModalMode === "add") {
      if (selectedFarmId) {
        const res = await addBackendZone(selectedFarmId, {
          name: zoneName.trim(),
          area: parsedArea,
          area_unit: zoneAreaUnit,
          crop: zoneCrop.trim(),
          soil_type: zoneSoil.trim(),
          crop_stage: "vegetative",
          status: zoneStatus === "Active Cultivation" ? "active" : zoneStatus === "Fallow / Resting" ? "fallow" : "quarantine",
        });
        setIsSavingZone(false);
        if (!res.success) {
          setZoneFormError(res.error || "Failed to create zone on backend.");
          return;
        }
        setSuccessNotification(`Field zone "${zoneName.trim()}" created successfully.`);
        setTimeout(() => setSuccessNotification(null), 4000);
        setZoneModalMode(null);
        return;
      }

      // Local Fallback
      addZone({
        name: zoneName.trim(),
        areaHa: parsedArea,
        crop: zoneCrop.trim(),
        soilType: zoneSoil.trim(),
        irrigation: zoneIrrigation,
        status: zoneStatus,
      });
      setIsSavingZone(false);
      setSuccessNotification(`Zone "${zoneName.trim()}" added to local profile.`);
      setTimeout(() => setSuccessNotification(null), 3000);
      setZoneModalMode(null);
      return;
    }

    if (zoneModalMode === "edit" && targetZoneId) {
      if (selectedFarmId && backendZones.some((bz) => bz.id === targetZoneId)) {
        const res = await updateBackendZone(targetZoneId, {
          name: zoneName.trim(),
          area: parsedArea,
          area_unit: zoneAreaUnit,
          crop: zoneCrop.trim(),
          soil_type: zoneSoil.trim(),
          status: zoneStatus === "Active Cultivation" ? "active" : zoneStatus === "Fallow / Resting" ? "fallow" : "quarantine",
        });
        setIsSavingZone(false);
        if (!res.success) {
          setZoneFormError(res.error || "Failed to update zone.");
          return;
        }
        setSuccessNotification(`Zone "${zoneName.trim()}" updated.`);
        setTimeout(() => setSuccessNotification(null), 4000);
        setZoneModalMode(null);
        return;
      }

      // Local fallback
      updateZone(targetZoneId, {
        name: zoneName.trim(),
        areaHa: parsedArea,
        crop: zoneCrop.trim(),
        soilType: zoneSoil.trim(),
        irrigation: zoneIrrigation,
        status: zoneStatus,
      });
      setIsSavingZone(false);
      setSuccessNotification(`Zone "${zoneName.trim()}" updated.`);
      setTimeout(() => setSuccessNotification(null), 3000);
      setZoneModalMode(null);
    }
  };

  // Delete Zone
  const handleDeleteZoneConfirm = async () => {
    if (!deletingZone) return;
    setIsDeletingZone(true);

    if (selectedFarmId && backendZones.some((bz) => bz.id === deletingZone.id)) {
      const res = await deleteBackendZone(deletingZone.id);
      setIsDeletingZone(false);
      setDeletingZone(null);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to delete zone.");
        return;
      }
      setSuccessNotification(`Zone "${deletingZone.name}" deleted.`);
      setTimeout(() => setSuccessNotification(null), 4000);
      return;
    }

    deleteLocalZone(deletingZone.id);
    setIsDeletingZone(false);
    setDeletingZone(null);
    setSuccessNotification(`Zone "${deletingZone.name}" removed.`);
    setTimeout(() => setSuccessNotification(null), 3000);
  };

  // Scan Risks via API
  const handleScanRisks = async () => {
    const farmId = selectedFarmId || "demo";
    setIsScanningRisks(true);
    setErrorMessage(null);
    try {
      if (selectedFarmId) {
        await detectRisks({ farm_id: selectedFarmId });
      }
      setSuccessNotification("Agronomic risk scan completed from latest sensor observations.");
      setTimeout(() => setSuccessNotification(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Risk scan failed.");
    } finally {
      setIsScanningRisks(false);
    }
  };

  // Generate AI Advisory
  const handleTriggerAI = async (risk: RiskAssessment) => {
    setEvaluatingRiskId(risk.id);
    setErrorMessage(null);
    try {
      const res = await evaluateRiskWithAI({ risk_id: risk.id, require_live: false });
      if (res.data) {
        setAiProposal({ risk, result: res.data });
        setSuccessNotification("AI Advisory formulated. Review recommendations below.");
        setTimeout(() => setSuccessNotification(null), 4000);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "AI evaluation failed.");
    } finally {
      setEvaluatingRiskId(null);
    }
  };

  // Save AI Action Plan
  const handleSaveActionPlan = async () => {
    if (!aiProposal || !selectedFarmId) return;
    setIsSavingPlan(true);
    try {
      await createActionPlan({
        farm_id: selectedFarmId,
        zone_id: aiProposal.risk.zone_id,
        risk_id: aiProposal.risk.id,
        ai_proposal: aiProposal.result.proposal,
      });
      setAiProposal(null);
      setSuccessNotification("Action plan saved to farm registry. Ready for field dispatch.");
      setTimeout(() => setSuccessNotification(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save action plan.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Create Field Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !selectedFarmId) return;
    setIsCreatingTask(true);
    try {
      await apiCreateTask({
        farm_id: selectedFarmId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        zone_id: taskZoneId || null,
        priority: taskPriority,
        source: "user",
      });
      setShowCreateTask(false);
      setTaskTitle("");
      setTaskDesc("");
      setSuccessNotification("Task created and assigned.");
      setTimeout(() => setSuccessNotification(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Computed Aggregations for Overview & Health
  const activeZonesList = useMemo(() => {
    if (selectedFarm && backendZones.length > 0) {
      return backendZones.map((bz) => ({
        id: bz.id,
        name: bz.name,
        // Unset fields stay unset; a zone's area, crop and soil are the farmer's
        // data, not something to guess at.
        area: bz.area ?? null,
        areaUnit: bz.area_unit || "acres",
        crop: bz.crop || "Not set",
        soil: bz.soil_type || "Not set",
        status: bz.status === "active" ? "Active Cultivation" : bz.status === "fallow" ? "Fallow / Resting" : "Soil Preparation",
        irrigation: "Drip",
      }));
    }
    return farm.zones.map((z) => ({
      id: z.id,
      name: z.name,
      area: z.areaHa,
      areaUnit: "acres",
      crop: z.crop,
      soil: z.soilType,
      status: z.status,
      irrigation: z.irrigation,
    }));
  }, [selectedFarm, backendZones, farm.zones]);

  const uniqueCrops = useMemo(() => {
    const list = Array.from(new Set(activeZonesList.map((z) => z.crop).filter(Boolean)));
    return list.length > 0 ? list : ["Sugarcane", "Banana", "Cotton"];
  }, [activeZonesList]);

  // Derived Overall Health Status
  const waterRisk = backendRisks.find((r) => r.risk_type.includes("water") || r.risk_type.includes("irrigation"));
  const pestRisk = backendRisks.find((r) => r.risk_type.includes("pest") || r.risk_type.includes("disease"));
  const nutrientRisk = backendRisks.find((r) => r.risk_type.includes("nutrient") || r.risk_type.includes("fertility"));

  const cropHealthStatus = useMemo(() => {
    if (pestRisk?.severity === "critical" || waterRisk?.severity === "critical") return { label: "Stressed", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", icon: "🔴" };
    if (pestRisk || waterRisk || nutrientRisk) return { label: "Attention Required", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "🟡" };
    return { label: "Good / Optimal", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "🟢" };
  }, [waterRisk, pestRisk, nutrientRisk]);

  const waterHealthStatus = useMemo(() => {
    if (waterRisk?.severity === "critical" || waterRisk?.severity === "high") return { label: "Deficit / Attention Needed", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", icon: "🔴", desc: "Root-zone soil moisture below optimal baseline." };
    if (waterRisk) return { label: "Moderate Deficit", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "🟡", desc: "Moisture levels trending downwards." };
    return { label: "Optimal Moisture", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "🟢", desc: "Soil moisture within target baseline." };
  }, [waterRisk]);

  const nutrientHealthStatus = useMemo(() => {
    if (nutrientRisk?.severity === "critical" || nutrientRisk?.severity === "high") return { label: "Critical Depletion", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", icon: "🔴", desc: "Available NPK depleted in 1+ parcels." };
    if (nutrientRisk) return { label: "Moderate Attention", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "🟡", desc: "Nutrient levels require top-dressing." };
    return { label: "Balanced / Normal", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "🟢", desc: "Macronutrient indices in target range." };
  }, [nutrientRisk]);

  const pestHealthStatus = useMemo(() => {
    if (pestRisk?.severity === "critical" || pestRisk?.severity === "high") return { label: "High Risk Detected", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", icon: "🔴", desc: "Microclimate favorable for spore germination." };
    if (pestRisk) return { label: "Elevated Risk", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "🟡", desc: "Monitor canopy humidity." };
    return { label: "Safe / Low Risk", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "🟢", desc: "Canopy humidity within safe bounds." };
  }, [pestRisk]);

  // Derived Monitoring Status
  const latestEventTimestamp = telemetryEvents[0]?.event_at;
  const isTelemetryFresh = latestEventTimestamp && Date.now() - new Date(latestEventTimestamp).getTime() < 7200000;
  const monitoringBadge = useMemo(() => {
    if (isTelemetryFresh) {
      return { label: "Monitoring Active", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500", icon: "🟢" };
    }
    if (latestEventTimestamp) {
      return { label: "Readings Stale", badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500", icon: "🟡" };
    }
    return { label: "No Data / Disconnected", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400", icon: "🔴" };
  }, [isTelemetryFresh, latestEventTimestamp]);

  // Task Counts
  const taskCounts = useMemo(() => {
    const open = backendTasks.filter((t) => ["pending", "assigned", "in_progress", "blocked"].includes(t.status)).length;
    const completed = backendTasks.filter((t) => t.status === "completed").length;
    const overdue = backendTasks.filter((t) => t.due_until && new Date(t.due_until).getTime() < Date.now() && t.status !== "completed").length;
    return { open, completed, overdue, total: backendTasks.length };
  }, [backendTasks]);

  return (
    <AppShell title="Farm Command & Management">
      <div className="space-y-7 pb-16 animate-fade-in">
        
        {/* ============================================================ */}
        {/* FLASH NOTIFICATIONS & ERROR BANNERS                          */}
        {/* ============================================================ */}
        {successNotification && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-900 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successNotification}</span>
            </div>
            <button type="button" onClick={() => setSuccessNotification(null)} className="text-slate-400 hover:text-slate-700 font-bold"><X size={15} /></button>
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-900 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-slate-700 font-bold"><X size={15} /></button>
          </div>
        )}

        {/* ============================================================ */}
        {/* SECTION A & B: FARM BASIC INFORMATION & OVERVIEW HERO        */}
        {/* ============================================================ */}
        <section className="rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-cyan-50/60 border border-emerald-200/90 p-6 text-slate-900 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          {/* Top Bar: Badges & Management Controls */}
          <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-0.5 text-[11px] font-bold text-emerald-800 shadow-xs">
                  <Sprout size={13} className="text-emerald-600" />
                  Farm Command
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border shadow-xs ${monitoringBadge.badge}`}>
                  <span className={`h-2 w-2 rounded-full ${monitoringBadge.dot}`} />
                  {monitoringBadge.label}
                </span>
                {selectedFarm?.is_demo && (
                  <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 shadow-xs">
                    Demo Farm
                  </span>
                )}
              </div>

              {/* Farm Title & Location */}
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-950">
                    {selectedFarm ? selectedFarm.name : farm.name}
                  </h1>

                  {/* Farm Switcher Dropdown */}
                  {backendFarms.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Building2 size={15} className="text-emerald-700" />
                      <select
                        aria-label="Switch Farm"
                        value={selectedFarmId || ""}
                        onChange={(e) => void selectFarm(e.target.value)}
                        className="rounded-xl bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 shadow-xs cursor-pointer focus:border-emerald-500 outline-none"
                      >
                        {backendFarms.map((f) => (
                          <option key={f.id} value={f.id} className="bg-white text-slate-900">
                            {f.name} {f.location ? `(${f.location})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-emerald-700" />
                    {selectedFarm?.location || farm.district || "Surat, South Gujarat, India"}
                  </span>
                  {selectedFarm?.address && (
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span>•</span>
                      {selectedFarm.address}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Layers size={14} className="text-emerald-700" />
                    Soil: {farmSoilType}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Droplets size={14} className="text-emerald-700" />
                    Irrigation: {farmIrrigation}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={openEditFarmModal} className={btnSecondary}>
                <Edit2 size={13} className="text-slate-500" /> Edit Farm
              </button>
              <button type="button" onClick={openAddZoneModal} className={btnPrimary}>
                <Plus size={14} /> Add Zone
              </button>
              <button type="button" onClick={() => setShowDeleteFarmConfirm(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-xs transition cursor-pointer">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>

          {/* Section B: Automated Overview Stat Grid */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6 pt-5 border-t border-emerald-200/70">
            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Area</p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                {selectedFarm?.total_area != null ? `${selectedFarm.total_area} ${selectedFarm.area_unit || "acres"}` : `${totalAreaHa} acres`}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Zones</p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">
                {activeZonesList.length} Zones
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Cultivation</p>
              <p className="text-lg font-extrabold text-emerald-700 mt-0.5">
                {activeZonesList.filter((z) => z.status === "Active Cultivation").length} Parcels
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Main Crops</p>
              <p className="text-xs font-bold text-emerald-800 mt-1 truncate">
                {uniqueCrops.join(" • ")}
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Farm Status</p>
              <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Operations
              </p>
            </div>

            <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-emerald-100 shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Sync</p>
              <p className="text-xs font-bold text-slate-700 mt-1">
                {formatRelativeTime(selectedFarm?.updated_at || new Date().toISOString())}
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION C & D: MONITORING STATUS & OVERALL FARM HEALTH MATRIX*/}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Section C: Monitoring Status Card */}
          <div className="glass-card rounded-2xl p-5 flex flex-col justify-between bg-white border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Radio size={14} className="text-emerald-600" /> Farm Telemetry Stream
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${monitoringBadge.badge}`}>
                  {monitoringBadge.label}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Connected Sensors:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {devices.filter((d) => d.enabled).length} / {devices.length || activeZonesList.length} Probes Active
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Streaming Zones:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {activeZonesList.length} / {activeZonesList.length} Parcels
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Last Observation:</span>
                  <span className="font-semibold text-slate-800">
                    {formatRelativeTime(latestEventTimestamp)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Exact Timestamp:</span>
                  <span className="font-mono text-slate-600 text-[11px]">
                    {formatIST(latestEventTimestamp)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">IoT Sampling Frequency: 15 mins</span>
              <button
                type="button"
                onClick={() => {
                  void refreshZones();
                  void refreshDevices();
                }}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} /> Sync Probes
              </button>
            </div>
          </div>

          {/* Section D: Overall Farm Health (4 Pillars) */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-5 bg-white border-slate-200 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <Activity size={16} />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Overall Farm Health Summary</h2>
                  <p className="text-[11px] text-slate-500">Holistic agronomic vitality aggregated across all active zones</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleScanRisks}
                disabled={isScanningRisks}
                className={btnSecondary}
              >
                <RefreshCw size={12} className={isScanningRisks ? "animate-spin text-emerald-600" : ""} />
                {isScanningRisks ? "Assessing…" : "Re-evaluate"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
              {/* Pillar 1: Crop Health */}
              <div className={`rounded-xl border p-3.5 ${cropHealthStatus.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sprout size={14} className="text-emerald-600" /> Crop Canopy Health
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${cropHealthStatus.color}`}>
                    {cropHealthStatus.icon} {cropHealthStatus.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Vegetative canopy vigour and NDVI indices across all active parcels.
                </p>
              </div>

              {/* Pillar 2: Water Status */}
              <div className={`rounded-xl border p-3.5 ${waterHealthStatus.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Droplets size={14} className="text-blue-600" /> Overall Water Status
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${waterHealthStatus.color}`}>
                    {waterHealthStatus.icon} {waterHealthStatus.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {waterHealthStatus.desc}
                </p>
              </div>

              {/* Pillar 3: Soil & Nutrients */}
              <div className={`rounded-xl border p-3.5 ${nutrientHealthStatus.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-amber-600" /> Soil & Nutrients (NPK)
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${nutrientHealthStatus.color}`}>
                    {nutrientHealthStatus.icon} {nutrientHealthStatus.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {nutrientHealthStatus.desc}
                </p>
              </div>

              {/* Pillar 4: Pest & Pathogen */}
              <div className={`rounded-xl border p-3.5 ${pestHealthStatus.bg}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-rose-600" /> Pest & Pathogen Pressure
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${pestHealthStatus.color}`}>
                    {pestHealthStatus.icon} {pestHealthStatus.label}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {pestHealthStatus.desc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION E: FARM-LEVEL RISK SUMMARY                           */}
        {/* ============================================================ */}
        <section className="glass-card rounded-2xl p-5 bg-white border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                <ShieldAlert size={17} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Farm-Level Risk Summary</h2>
                  <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-bold">
                    {backendRisks.length} Active Incident{backendRisks.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Summary overview of active threats impacting farm parcels</p>
              </div>
            </div>

            <Link href="/risks" className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1">
              Detailed Risk Center <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Water Stress Summary */}
            <div className={`rounded-xl border p-4 ${waterRisk ? "bg-rose-50/70 border-rose-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Droplets size={14} className={waterRisk ? "text-rose-600" : "text-emerald-600"} />
                  Water Stress
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${waterRisk ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                  {waterRisk ? waterRisk.severity.toUpperCase() : "SAFE"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {waterRisk ? `${formatRiskType(waterRisk.risk_type)} detected in 1 parcel.` : "Root-zone soil moisture is within normal parameters."}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Affected Parcels:</span>
                <span className="font-bold text-slate-800">{waterRisk ? "1 Zone (Zone B)" : "0 Zones"}</span>
              </div>
            </div>

            {/* Pest & Disease Summary */}
            <div className={`rounded-xl border p-4 ${pestRisk ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Leaf size={14} className={pestRisk ? "text-amber-600" : "text-emerald-600"} />
                  Pest & Pathogen
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${pestRisk ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                  {pestRisk ? pestRisk.severity.toUpperCase() : "SAFE"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {pestRisk ? `${formatRiskType(pestRisk.risk_type)} alert.` : "Canopy humidity safe; fungal sporulation risk low."}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Affected Parcels:</span>
                <span className="font-bold text-slate-800">{pestRisk ? "1 Zone (Canal View)" : "0 Zones"}</span>
              </div>
            </div>

            {/* Nutrient Deficiency Summary */}
            <div className={`rounded-xl border p-4 ${nutrientRisk ? "bg-amber-50/70 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Layers size={14} className={nutrientRisk ? "text-amber-600" : "text-emerald-600"} />
                  Nutrient Deficiency
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${nutrientRisk ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"}`}>
                  {nutrientRisk ? nutrientRisk.severity.toUpperCase() : "SAFE"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {nutrientRisk ? `${formatRiskType(nutrientRisk.risk_type)} alert.` : "NPK macronutrient indices are within vegetative baselines."}
              </p>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Affected Parcels:</span>
                <span className="font-bold text-slate-800">{nutrientRisk ? "1 Zone (East Orchard)" : "0 Zones"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION F & G: WEATHER & FARM AI ADVISORY SUMMARY            */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Section F: Weather Card */}
          <div className="lg:col-span-1">
            <LiveWeatherCard />
          </div>

          {/* Section G: Farm AI Advisory Summary */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-5 bg-white border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 border border-violet-200 text-violet-700">
                    <Bot size={17} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">Farm AI Advisory Summary</h2>
                      <span className="rounded-full bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 text-[10px] font-bold">
                        Multi-Agent
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">Synthesized farm-wide operational guidance from Gemini multi-agent supervisor</p>
                  </div>
                </div>

                <Link href="/plans" className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline">
                  Action Plans ↗
                </Link>
              </div>

              {/* Live AI Proposal Preview if active */}
              {aiProposal ? (
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/70 p-4 animate-fade-in shadow-xs">
                  <div className="flex items-center justify-between border-b border-violet-200 pb-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-violet-900 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-violet-600" /> New Agronomic Proposal
                    </span>
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full border border-violet-200">
                      Confidence: {aiProposal.result.proposal.confidence != null
                        ? `${Math.round(aiProposal.result.proposal.confidence * 100)}%`
                        : "not reported"}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-violet-100">
                      <p className="text-[10px] font-bold uppercase text-rose-600">Problem Detected</p>
                      <p className="font-bold text-slate-900 mt-0.5">{formatRiskType(aiProposal.risk.risk_type)}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-violet-100">
                      <p className="text-[10px] font-bold uppercase text-violet-600">Recommended Action</p>
                      <p className="font-bold text-slate-900 mt-0.5">{aiProposal.result.proposal.recommendation}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3.5">
                    <button type="button" onClick={handleSaveActionPlan} disabled={isSavingPlan} className={btnPrimary}>
                      {isSavingPlan ? "Saving Plan…" : "Approve & Save Plan"}
                    </button>
                    <button type="button" onClick={() => setAiProposal(null)} className={btnSecondary}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {backendRisks.length > 0 ? (
                    backendRisks.slice(0, 2).map((risk) => (
                      <div key={risk.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              ⚠️ {formatRiskType(risk.risk_type)} detected in farm parcel
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getSeverityStyle(risk.severity).badgeClass}`}>
                              {risk.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {typeof risk.evidence?.explanation === "string" ? risk.evidence.explanation : "Sensor deviations require corrective schedule."}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={evaluatingRiskId === risk.id}
                          onClick={() => handleTriggerAI(risk)}
                          className={btnSecondary}
                        >
                          <Bot size={13} className="text-violet-600" />
                          {evaluatingRiskId === risk.id ? "Analyzing…" : "Get AI Advisory"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center text-xs text-slate-500">
                      <ShieldCheck size={28} className="mx-auto text-emerald-600 mb-2" />
                      All farm parcels are operating in safe baseline parameters. No critical advisories pending.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Safety policy: Operator sign-off required for spray / irrigation actuation.</span>
              <span className="font-semibold text-emerald-700">SafetyGuard Enabled</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION H: FARM ACTIONS & TASKS SUMMARY                      */}
        {/* ============================================================ */}
        <section className="glass-card rounded-2xl p-5 bg-white border-slate-200 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                <CheckCircle2 size={17} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Farm Actions & Field Tasks</h2>
                <p className="text-xs text-slate-500">Track pending, active, and completed task executions</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowCreateTask(!showCreateTask)} className={btnPrimary}>
                <Plus size={14} /> New Task
              </button>
              <Link href="/tasks" className={btnSecondary}>
                View All Tasks ↗
              </Link>
            </div>
          </div>

          {/* Task Summary Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Open Tasks</p>
              <p className="text-2xl font-extrabold text-emerald-700 mt-0.5">{taskCounts.open}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Completed</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{taskCounts.completed}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Overdue</p>
              <p className="text-2xl font-extrabold text-rose-600 mt-0.5">{taskCounts.overdue}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Logged</p>
              <p className="text-2xl font-extrabold text-slate-700 mt-0.5">{taskCounts.total}</p>
            </div>
          </div>

          {/* Quick Create Task Form */}
          {showCreateTask && (
            <form onSubmit={handleCreateTask} className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Create Field Task</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Task Title *</label>
                  <input type="text" required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Inspect Drip Emitters in Zone B" className={inputStyle} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Target Zone</label>
                  <select value={taskZoneId} onChange={(e) => setTaskZoneId(e.target.value)} className={inputStyle}>
                    <option value="">Farm-wide</option>
                    {activeZonesList.map((z) => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description / Protocol</label>
                <input type="text" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Specific instructions for farm operator..." className={inputStyle} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateTask(false)} className={btnSecondary}>Cancel</button>
                <button type="submit" disabled={isCreatingTask} className={btnPrimary}>
                  {isCreatingTask ? "Saving…" : "Save Task"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ============================================================ */}
        {/* SECTION I: REGISTERED FIELD ZONES & FARM MANAGEMENT          */}
        {/* ============================================================ */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Registered Field Zones & Parcels</h2>
              <p className="text-xs text-slate-500">Individual management units with distinct crops, soil texture, and irrigation infrastructure</p>
            </div>
            <button type="button" onClick={openAddZoneModal} className={btnPrimary}>
              <Plus size={14} /> Add Field Zone
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeZonesList.map((zone) => (
              <Card key={zone.id} className="p-5 flex flex-col justify-between bg-white border-slate-200 shadow-xs hover:border-emerald-300 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{zone.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          zone.status === "Active Cultivation" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : zone.status === "Soil Preparation" ? "bg-blue-100 text-blue-800 border-blue-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }`}>
                          {zone.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <Sprout size={13} /> {zone.crop}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditZoneModal(zone)}
                        aria-label={`Edit ${zone.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingZone(zone)}
                        aria-label={`Delete ${zone.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Parcel Area:</span>
                      <strong className="text-slate-900 font-mono">{zone.area} {zone.areaUnit}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Soil Classification:</span>
                      <span className="text-slate-700 font-medium">{zone.soil}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Irrigation Method:</span>
                      <span className="text-slate-700 font-medium">{zone.irrigation}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Sensor Node:</span>
                      <span className="text-emerald-700 font-medium">In-Ground (15cm)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px]">
                  <Link
                    href={`/zones?id=${zone.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                  >
                    <span>Inspect Zone & Telemetry</span>
                    <ArrowRight size={12} />
                  </Link>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active Probe
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ============================================================ */}
        {/* MODAL 1: EDIT / CREATE FARM DETAILS                          */}
        {/* ============================================================ */}
        {editingFarm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="farm-modal-title">
            <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-fade-in text-slate-800 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                    <Building2 size={16} />
                  </span>
                  <h3 id="farm-modal-title" className="text-base font-bold text-slate-900">
                    Edit Farm Profile & Basic Information
                  </h3>
                </div>
                <button type="button" onClick={() => setEditingFarm(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveFarm} className="mt-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Farm Name *</label>
                    <input type="text" required value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. Green Valley Agro Farm" className={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Location (District / State) *</label>
                    <input type="text" required value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="e.g. Surat, Gujarat" className={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Farm Address</label>
                  <input type="text" value={farmAddress} onChange={(e) => setFarmAddress(e.target.value)} placeholder="Plot 42, Green Belt Corridor, Surat, Gujarat" className={inputStyle} />
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Total Farm Area *</label>
                    <input type="number" step="0.1" min="0.1" required value={farmTotalArea} onChange={(e) => setFarmTotalArea(e.target.value)} className={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Area Unit</label>
                    <select value={farmAreaUnit} onChange={(e) => setFarmAreaUnit(e.target.value)} className={inputStyle}>
                      <option value="acres">Acres</option>
                      <option value="hectares">Hectares</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Soil Type</label>
                    <input type="text" value={farmSoilType} onChange={(e) => setFarmSoilType(e.target.value)} placeholder="e.g. Medium Black Clayey Loam" className={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Main Crop(s)</label>
                    <input type="text" value={farmMainCrops} onChange={(e) => setFarmMainCrops(e.target.value)} placeholder="e.g. Sugarcane, Banana, Cotton" className={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Irrigation System</label>
                  <select value={farmIrrigation} onChange={(e) => setFarmIrrigation(e.target.value)} className={inputStyle}>
                    <option value="Drip">Drip Irrigation</option>
                    <option value="Sprinkler">Sprinkler Network</option>
                    <option value="Flood / Furrow">Flood / Furrow</option>
                    <option value="Rainfed">Rainfed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Farm Description</label>
                  <textarea rows={2} value={farmDescription} onChange={(e) => setFarmDescription(e.target.value)} placeholder="Agricultural background, topography, micro-climate notes..." className={inputStyle} />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => setEditingFarm(false)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={isSavingFarm} className={btnPrimary}>
                    {isSavingFarm ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : "Save Farm Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 2: ADD / EDIT ZONE                                     */}
        {/* ============================================================ */}
        {zoneModalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="zone-modal-title">
            <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-fade-in text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 id="zone-modal-title" className="text-base font-bold text-slate-900">
                  {zoneModalMode === "add" ? "Add Field Zone Parcel" : "Edit Field Zone Parcel"}
                </h3>
                <button type="button" onClick={() => setZoneModalMode(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveZone} className="mt-4 space-y-4">
                {zoneFormError && (
                  <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                    <AlertCircle size={15} /> {zoneFormError}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Zone / Parcel Name *</label>
                    <input type="text" required value={zoneName} onChange={(e) => setZoneName(e.target.value)} placeholder="e.g. Zone A - North Orchard" className={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Parcel Area *</label>
                    <input type="number" step="0.1" min="0.1" required value={zoneArea} onChange={(e) => setZoneArea(e.target.value)} className={inputStyle} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Cultivated Crop</label>
                    <input type="text" value={zoneCrop} onChange={(e) => setZoneCrop(e.target.value)} placeholder="e.g. Sugarcane" className={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Soil Texture</label>
                    <input type="text" value={zoneSoil} onChange={(e) => setZoneSoil(e.target.value)} placeholder="e.g. Clay Loam" className={inputStyle} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Irrigation Method</label>
                    <select value={zoneIrrigation} onChange={(e) => setZoneIrrigation(e.target.value as "Drip")} className={inputStyle}>
                      <option value="Drip">Drip</option>
                      <option value="Sprinkler">Sprinkler</option>
                      <option value="Flood / Furrow">Flood / Furrow</option>
                      <option value="Rainfed">Rainfed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Management Status</label>
                    <select value={zoneStatus} onChange={(e) => setZoneStatus(e.target.value as "Active Cultivation")} className={inputStyle}>
                      <option value="Active Cultivation">Active Cultivation</option>
                      <option value="Soil Preparation">Soil Preparation</option>
                      <option value="Fallow / Resting">Fallow / Resting</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => setZoneModalMode(null)} className={btnSecondary}>Cancel</button>
                  <button type="submit" disabled={isSavingZone} className={btnPrimary}>
                    {isSavingZone ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : zoneModalMode === "add" ? "Create Zone" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 3: DELETE ZONE CONFIRMATION                            */}
        {/* ============================================================ */}
        {deletingZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-fade-in text-slate-800">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertCircle size={22} />
                <h3 className="text-base font-bold text-slate-900">Delete Field Zone?</h3>
              </div>
              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900">{deletingZone.name}</strong>
                {deletingZone.area != null ? ` (${deletingZone.area} ${farmAreaUnit || "acres"})` : ""}? This action will remove all bound sensor associations.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setDeletingZone(null)} className={btnSecondary}>Cancel</button>
                <button type="button" onClick={handleDeleteZoneConfirm} disabled={isDeletingZone} className={btnDanger}>
                  {isDeletingZone ? "Deleting…" : "Delete Parcel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MODAL 4: DELETE FARM CONFIRMATION                            */}
        {/* ============================================================ */}
        {showDeleteFarmConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl animate-fade-in text-slate-800">
              <div className="flex items-center gap-3 text-rose-600">
                <AlertCircle size={22} />
                <h3 className="text-base font-bold text-slate-900">Delete Entire Farm?</h3>
              </div>
              <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                This will permanently delete <strong className="text-slate-900">{selectedFarm?.name || farm.name}</strong> along with all registered field zones, sensors, and risk evaluations.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowDeleteFarmConfirm(false)} className={btnSecondary}>Cancel</button>
                <button type="button" onClick={handleDeleteFarm} disabled={isDeletingFarm} className={btnDanger}>
                  {isDeletingFarm ? "Deleting…" : "Permanently Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    </AppShell>
  );
}
