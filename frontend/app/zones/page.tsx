"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { Card, PageHeading } from "../../components/ui";
import { useFarm, type FarmZone } from "../../context/farm-context";
import { AuthModal } from "../../components/auth-modal";
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
  createDevice,
  deleteDevice,
  createTelemetryEvent,
  updateZone as apiUpdateZone,
} from "../../lib/api/farmops";
import { formatRiskType, getSeverityStyle } from "../../lib/risks";
import type {
  AIEvaluationResponse,
  ActionPlan,
  RiskAssessment,
  Task as BackendTask,
  Zone as BackendZone,
  Device as BackendDevice,
  SensorEventResponse,
} from "../../types/api";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Droplets,
  Edit2,
  Eye,
  History,
  Layers,
  Leaf,
  Loader2,
  MapPin,
  Maximize2,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Trash2,
  Waves,
  Wind,
  X,
  Zap,
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
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

// Helper to determine zone sensor status & thresholds
function getMoistureStatus(vwc?: number | null) {
  if (vwc === undefined || vwc === null) return { text: "No Data", color: "text-slate-400 bg-slate-100", dot: "bg-slate-400", level: "nodata" };
  if (vwc < 25) return { text: "Critical Dry", color: "text-rose-700 bg-rose-50 border-rose-200", dot: "bg-rose-500", level: "critical" };
  if (vwc < 35) return { text: "Attention Required", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", level: "warning" };
  if (vwc <= 65) return { text: "Optimal", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", level: "healthy" };
  return { text: "Waterlogged", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500", level: "warning" };
}

function getZoneHealthBadge(zoneStatus: string, hasCriticalRisk: boolean, hasWarningRisk: boolean) {
  if (hasCriticalRisk) {
    return {
      label: "Critical",
      badge: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500 animate-pulse",
      icon: AlertTriangle,
    };
  }
  if (hasWarningRisk) {
    return {
      label: "Attention Required",
      badge: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
      icon: AlertCircle,
    };
  }
  if (zoneStatus === "Active Cultivation" || zoneStatus === "active") {
    return {
      label: "Healthy",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
      icon: ShieldCheck,
    };
  }
  return {
    label: zoneStatus || "Resting",
    badge: "bg-slate-50 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
    icon: Leaf,
  };
}

function ZonesPageContent() {
  const searchParams = useSearchParams();
  const initialZoneId = searchParams.get("id");

  const {
    farm,
    backendFarms,
    selectedFarm,
    selectedFarmId,
    backendZones,
    isLoadingFarms,
    isLoadingZones,
    backendRisks,
    backendTasks,
    devices,
    telemetryEvents,
    latestTelemetry,
    currentUser,
    addBackendZone,
    updateBackendZone,
    deleteBackendZone,
    addZone: addLocalZone,
    updateZone: updateLocalZone,
    deleteZone: removeLocalZone,
    refreshBackendState,
  } = useFarm();

  // Unified Zones list (backend + local fallback)
  const unifiedZones = useMemo(() => {
    if (backendZones.length > 0) {
      return backendZones.map((bz) => ({
        id: bz.id,
        name: bz.name,
        areaHa: bz.area || 5.0,
        crop: bz.crop || "Sugarcane",
        soilType: bz.soil_type || "Clay Loam",
        irrigation: "Drip" as const,
        status: (bz.status === "active" ? "Active Cultivation" : bz.status) as any,
        isBackend: true,
        cropStage: bz.crop_stage || "vegetative",
        geometry: bz.geometry,
      }));
    }
    return farm.zones.map((lz) => ({
      id: lz.id,
      name: lz.name,
      areaHa: lz.areaHa,
      crop: lz.crop,
      soilType: lz.soilType,
      irrigation: lz.irrigation,
      status: lz.status,
      isBackend: false,
      cropStage: "vegetative",
      geometry: null,
    }));
  }, [backendZones, farm.zones]);

  // Active Selected Zone
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  useEffect(() => {
    if (initialZoneId && unifiedZones.some((z) => z.id === initialZoneId)) {
      setSelectedZoneId(initialZoneId);
    } else if (unifiedZones.length > 0 && (!selectedZoneId || !unifiedZones.some((z) => z.id === selectedZoneId))) {
      setSelectedZoneId(unifiedZones[0].id);
    }
  }, [initialZoneId, unifiedZones, selectedZoneId]);

  const activeZone = useMemo(() => {
    return unifiedZones.find((z) => z.id === selectedZoneId) || unifiedZones[0] || null;
  }, [unifiedZones, selectedZoneId]);

  // Zone specific risks
  const zoneRisks = useMemo(() => {
    if (!activeZone) return [];
    return backendRisks.filter((r) => r.zone_id === activeZone.id || (!r.zone_id && backendRisks.length <= 2));
  }, [backendRisks, activeZone]);

  const criticalRisks = useMemo(() => zoneRisks.filter((r) => r.severity === "critical" || r.severity === "high"), [zoneRisks]);
  const warningRisks = useMemo(() => zoneRisks.filter((r) => r.severity === "low"), [zoneRisks]);

  // Zone specific tasks
  const zoneTasks = useMemo(() => {
    if (!activeZone) return [];
    return backendTasks.filter(
      (t) =>
        t.zone_id === activeZone.id ||
        t.zone_id === activeZone.name ||
        Boolean(t.title && t.title.toLowerCase().includes(activeZone.name.toLowerCase()))
    );
  }, [backendTasks, activeZone]);

  // Zone specific devices
  const zoneDevices = useMemo(() => {
    if (!activeZone) return [];
    return devices.filter((d) => d.zone_id === activeZone.id);
  }, [devices, activeZone]);

  // Zone specific telemetry events
  const zoneTelemetryEvents = useMemo(() => {
    if (!activeZone) return [];
    return telemetryEvents.filter((e) => e.zone_id === activeZone.id);
  }, [telemetryEvents, activeZone]);

  // Latest readings for active zone
  const zoneMeasurements = useMemo(() => {
    if (!activeZone) return null;
    // Only this zone's own events. Falling back to another zone's reading would
    // attribute one field's measurement to a different field.
    const latestEvent = zoneTelemetryEvents[0];
    const rawMeasures = (latestEvent?.measurements || {}) as Record<string, unknown>;

    /** A metric that was not reported stays null; it is never defaulted to a plausible number. */
    const read = (...keys: string[]): number | null => {
      for (const key of keys) {
        const value = rawMeasures[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
      }
      return null;
    };

    return {
      soilMoisture: read("soil_moisture", "moisture"),
      soilTemp: read("soil_temp", "soil_temperature"),
      airTemp: read("air_temp", "air_temperature", "temperature"),
      humidity: read("humidity", "air_humidity"),
      soilPh: read("ph", "soil_ph"),
      soilEc: read("ec", "soil_ec"),
      rainfall: read("rainfall", "precipitation", "rain"),
      waterLevel: read("water_level"),
      lastUpdate: latestEvent?.event_at ?? null,
      sensorCount: zoneDevices.length,
      hasReadings: Boolean(latestEvent),
    };
  }, [activeZone, zoneTelemetryEvents, zoneDevices]);

  // UI State: Tabs & Modals
  const [historyTab, setHistoryTab] = useState<"telemetry" | "risks" | "advisory" | "tasks">("telemetry");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [showEditZoneModal, setShowEditZoneModal] = useState(false);
  const [showDeleteZoneModal, setShowDeleteZoneModal] = useState(false);
  const [showConnectSensorModal, setShowConnectSensorModal] = useState(false);
  const [showChangeCropModal, setShowChangeCropModal] = useState(false);
  const [showUpdateIrrigationModal, setShowUpdateIrrigationModal] = useState(false);
  const [showManualReadingModal, setShowManualReadingModal] = useState(false);

  // Form states for zone CRUD
  const [formZoneName, setFormZoneName] = useState("");
  const [formZoneArea, setFormZoneArea] = useState("5.0");
  const [formZoneCrop, setFormZoneCrop] = useState("Sugarcane");
  const [formZoneSoil, setFormZoneSoil] = useState("Medium Black Clayey Loam");
  const [formZoneIrrigation, setFormZoneIrrigation] = useState<"Drip" | "Sprinkler" | "Flood / Furrow" | "Rainfed">("Drip");
  const [formZoneStatus, setFormZoneStatus] = useState<"Active Cultivation" | "Soil Preparation" | "Fallow / Resting">("Active Cultivation");
  const [formCropStage, setFormCropStage] = useState("vegetative");
  const [isSubmittingZone, setIsSubmittingZone] = useState(false);

  // Device & Sensor form state
  const [sensorType, setSensorType] = useState<"soil_sensor" | "weather_station" | "multispectral_camera" | "gateway">("soil_sensor");
  const [sensorRef, setSensorRef] = useState("");
  const [isConnectingSensor, setIsConnectingSensor] = useState(false);

  // Manual Reading form state
  const [manualMoisture, setManualMoisture] = useState("35.0");
  const [manualPh, setManualPh] = useState("6.5");
  const [manualTemp, setManualTemp] = useState("26.0");
  const [manualHumidity, setManualHumidity] = useState("60.0");
  const [isSubmittingReading, setIsSubmittingReading] = useState(false);

  // AI Advisory & Action Plan Execution
  const [isScanningZoneRisks, setIsScanningZoneRisks] = useState(false);
  const [evaluatingRiskId, setEvaluatingRiskId] = useState<string | null>(null);
  const [aiProposal, setAiProposal] = useState<{ risk: RiskAssessment; result: AIEvaluationResponse } | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Open Edit Zone Modal
  const openEditModal = () => {
    if (!activeZone) return;
    setFormZoneName(activeZone.name);
    setFormZoneArea(activeZone.areaHa.toString());
    setFormZoneCrop(activeZone.crop);
    setFormZoneSoil(activeZone.soilType);
    setFormZoneIrrigation(activeZone.irrigation as any);
    setFormZoneStatus(activeZone.status as any);
    setFormCropStage(activeZone.cropStage || "vegetative");
    setShowEditZoneModal(true);
  };

  // Handle Save / Edit Zone
  const handleSaveEditZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone || !formZoneName.trim()) return;
    setIsSubmittingZone(true);
    setErrorMessage(null);

    const parsedArea = parseFloat(formZoneArea) || 1.0;

    if (activeZone.isBackend) {
      const res = await updateBackendZone(activeZone.id, {
        name: formZoneName.trim(),
        area: parsedArea,
        crop: formZoneCrop.trim(),
        soil_type: formZoneSoil.trim(),
        crop_stage: formCropStage,
        status: formZoneStatus === "Active Cultivation" ? "active" : formZoneStatus.toLowerCase(),
      });
      setIsSubmittingZone(false);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to update zone on backend.");
        return;
      }
    } else {
      updateLocalZone(activeZone.id, {
        name: formZoneName.trim(),
        areaHa: parsedArea,
        crop: formZoneCrop.trim(),
        soilType: formZoneSoil.trim(),
        irrigation: formZoneIrrigation,
        status: formZoneStatus,
      });
      setIsSubmittingZone(false);
    }

    setSuccessNotification(`Zone "${formZoneName.trim()}" updated successfully.`);
    setTimeout(() => setSuccessNotification(null), 3500);
    setShowEditZoneModal(false);
  };

  // Handle Add Zone
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formZoneName.trim()) {
      setErrorMessage("Zone name cannot be empty.");
      return;
    }
    setIsSubmittingZone(true);
    setErrorMessage(null);

    const parsedArea = parseFloat(formZoneArea) || 1.0;

    if (selectedFarm && selectedFarmId) {
      const res = await addBackendZone(selectedFarmId, {
        name: formZoneName.trim(),
        area: parsedArea,
        area_unit: selectedFarm.area_unit || "hectare",
        crop: formZoneCrop.trim(),
        soil_type: formZoneSoil.trim(),
        crop_stage: formCropStage,
        status: formZoneStatus === "Active Cultivation" ? "active" : "active",
      });
      setIsSubmittingZone(false);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to add zone on backend.");
        return;
      }
      if (res.data?.id) setSelectedZoneId(res.data.id);
    } else {
      addLocalZone({
        name: formZoneName.trim(),
        areaHa: parsedArea,
        crop: formZoneCrop.trim(),
        soilType: formZoneSoil.trim(),
        irrigation: formZoneIrrigation,
        status: formZoneStatus,
      });
      setIsSubmittingZone(false);
    }

    setSuccessNotification(`New zone "${formZoneName.trim()}" created.`);
    setTimeout(() => setSuccessNotification(null), 3500);
    setShowAddZoneModal(false);
  };

  // Handle Delete Zone
  const handleDeleteZone = async () => {
    if (!activeZone) return;
    setIsSubmittingZone(true);
    setErrorMessage(null);

    if (activeZone.isBackend) {
      const res = await deleteBackendZone(activeZone.id);
      setIsSubmittingZone(false);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to delete zone from backend.");
        return;
      }
    } else {
      removeLocalZone(activeZone.id);
      setIsSubmittingZone(false);
    }

    setSuccessNotification(`Zone "${activeZone.name}" deleted.`);
    setTimeout(() => setSuccessNotification(null), 3500);
    setShowDeleteZoneModal(false);
  };

  // Handle Quick Crop Change
  const handleChangeCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone || !formZoneCrop.trim()) return;
    setIsSubmittingZone(true);

    if (activeZone.isBackend) {
      await updateBackendZone(activeZone.id, {
        crop: formZoneCrop.trim(),
        crop_stage: formCropStage,
      });
    } else {
      updateLocalZone(activeZone.id, { crop: formZoneCrop.trim() });
    }

    setIsSubmittingZone(false);
    setSuccessNotification(`Crop for ${activeZone.name} changed to ${formZoneCrop.trim()}.`);
    setTimeout(() => setSuccessNotification(null), 3500);
    setShowChangeCropModal(false);
  };

  // Handle Quick Irrigation Update
  const handleUpdateIrrigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone) return;
    setIsSubmittingZone(true);

    updateLocalZone(activeZone.id, { irrigation: formZoneIrrigation });
    setIsSubmittingZone(false);
    setSuccessNotification(`Irrigation method updated to ${formZoneIrrigation}.`);
    setTimeout(() => setSuccessNotification(null), 3500);
    setShowUpdateIrrigationModal(false);
  };

  // Connect Sensor to Zone
  const handleConnectSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone) return;
    setIsConnectingSensor(true);
    setErrorMessage(null);

    if (selectedFarmId) {
      try {
        const res = await createDevice(selectedFarmId, {
          zone_id: activeZone.id,
          device_type: sensorType,
          credential_reference: sensorRef.trim() || `NODE-${sensorType.toUpperCase().slice(0, 4)}-${Date.now().toString().slice(-4)}`,
          calibration: { sensitivity: 1.0, installed_at: new Date().toISOString() },
          enabled: true,
          is_demo: false,
        });

        if (!res.success) {
          setErrorMessage(res.message || "Failed to register sensor device.");
          setIsConnectingSensor(false);
          return;
        }

        await refreshBackendState();
        setSuccessNotification(`Connected new ${sensorType.replace("_", " ")} to ${activeZone.name}.`);
      } catch (err: any) {
        setErrorMessage(err.message || "Error registering hardware sensor.");
      }
    } else {
      setSuccessNotification(`Demo sensor (${sensorType.replace("_", " ")}) registered to ${activeZone.name}.`);
    }

    setIsConnectingSensor(false);
    setShowConnectSensorModal(false);
    setTimeout(() => setSuccessNotification(null), 4000);
  };

  // Ingest Manual Telemetry Reading
  const handleRecordReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZone) return;
    setIsSubmittingReading(true);
    setErrorMessage(null);

    const mVal = parseFloat(manualMoisture) || 35.0;
    const phVal = parseFloat(manualPh) || 6.5;
    const tVal = parseFloat(manualTemp) || 26.0;
    const hVal = parseFloat(manualHumidity) || 60.0;

    if (selectedFarmId) {
      try {
        await createTelemetryEvent({
          device_id: zoneDevices[0]?.id || `DEV-MANUAL-${activeZone.id.slice(0, 6)}`,
          sequence: Math.floor(Date.now() / 1000) % 1000000,
          event_timestamp: new Date().toISOString(),
          measurements: {
            soil_moisture: mVal,
            ph: phVal,
            soil_temp: tVal,
            humidity: hVal,
          },
          metadata: {
            farm_id: selectedFarmId,
            zone_id: activeZone.id,
            source: "manual_field_entry",
          },
        });
        await refreshBackendState();
        setSuccessNotification(`Field reading recorded for ${activeZone.name}.`);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to submit field reading.");
      }
    } else {
      setSuccessNotification(`Field reading (Moisture: ${mVal}%, pH: ${phVal}) saved.`);
    }

    setIsSubmittingReading(false);
    setShowManualReadingModal(false);
    setTimeout(() => setSuccessNotification(null), 3500);
  };

  // Run Zone Risk Detection
  const handleTriggerZoneRiskScan = async () => {
    if (!activeZone) return;
    setIsScanningZoneRisks(true);
    setErrorMessage(null);

    if (selectedFarmId) {
      try {
        const res = await detectRisks({
          farm_id: selectedFarmId,
          zone_id: activeZone.id,
        });
        await refreshBackendState();
        setSuccessNotification(`Zone risk scan completed. ${res.data?.length || 0} active risks assessed.`);
      } catch (err: any) {
        setErrorMessage(err.message || "Zone risk scan failed.");
      }
    } else {
      await new Promise((r) => setTimeout(r, 900));
      setSuccessNotification(`Local diagnostic scan for ${activeZone.name} complete.`);
    }

    setIsScanningZoneRisks(false);
    setTimeout(() => setSuccessNotification(null), 4000);
  };

  // Evaluate Risk with AI
  const handleEvaluateWithAI = async (risk: RiskAssessment) => {
    setEvaluatingRiskId(risk.id);
    setErrorMessage(null);

    try {
      const res = await evaluateRiskWithAI({
        risk_id: risk.id,
        require_live: false,
      });

      if (res.success && res.data) {
        setAiProposal({ risk, result: res.data });
      } else {
        setErrorMessage(res.message || "Failed to generate AI evaluation for this zone risk.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "AI Evaluation service error.");
    } finally {
      setEvaluatingRiskId(null);
    }
  };

  // Generate & Approve Action Plan from AI Proposal
  const handleApproveAIProposal = async () => {
    if (!aiProposal || !activeZone) return;
    setIsSavingPlan(true);

    try {
      const planRes = await createActionPlan({
        farm_id: aiProposal.risk.farm_id || selectedFarmId || "farm-1",
        zone_id: activeZone.id,
        risk_id: aiProposal.risk.id,
        title: `Zone ${activeZone.name}: ${aiProposal.result.proposal.recommendation.slice(0, 60)}...`,
        action_type: aiProposal.result.proposal.risk_type === "water_stress" ? "irrigation_adjustment" : "treatment_application",
        action_summary: aiProposal.result.proposal.recommendation,
        rationale: aiProposal.result.proposal.rationale,
        ai_proposal: aiProposal.result.proposal,
        evidence: {
          zone_id: activeZone.id,
          zone_name: activeZone.name,
          crop: activeZone.crop,
          urgency: aiProposal.result.proposal.urgency,
          assumptions: aiProposal.result.proposal.assumptions,
        },
      });

      if (planRes.success && planRes.data) {
        if (planRes.data.approval_state === "pending_approval") {
          await approveActionPlan(planRes.data.id, { review_notes: "Approved via Zone AI Advisory Console" });
        }
        await refreshBackendState();
        setSuccessNotification(`Action plan created and approved for ${activeZone.name}!`);
        setAiProposal(null);
      } else {
        setErrorMessage(planRes.message || "Failed to create action plan.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Error finalizing action plan.");
    } finally {
      setIsSavingPlan(false);
      setTimeout(() => setSuccessNotification(null), 4000);
    }
  };

  // Status computation for active zone
  const moistureStatus = getMoistureStatus(zoneMeasurements?.soilMoisture);
  const zoneHealth = getZoneHealthBadge(activeZone?.status || "active", criticalRisks.length > 0, warningRisks.length > 0);
  const ZoneHealthIcon = zoneHealth.icon;

  return (
    <AppShell title="Crop Zones Management">
      <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top Header & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <PageHeading
            title="Field Zones Management"
            description="Manage individual parcels, monitor real-time sensor streams, track crop development, and execute zone-level AI advisories."
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddZoneModal(true)}
              className={btnPrimary}
              id="btn-add-zone"
            >
              <Plus className="h-4 w-4" />
              <span>Add Zone</span>
            </button>
            <button
              onClick={handleTriggerZoneRiskScan}
              disabled={isScanningZoneRisks}
              className={btnSecondary}
              title="Run automated deterministic risk scan for active zone"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isScanningZoneRisks ? "animate-spin text-emerald-600" : ""}`} />
              <span>{isScanningZoneRisks ? "Scanning Zone..." : "Scan Zone Risks"}</span>
            </button>
            <Link href="/farm" className={btnSecondary}>
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Farm</span>
            </Link>
          </div>
        </div>

        {/* Notifications & Error Banners */}
        {successNotification && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 backdrop-blur-sm p-4 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{successNotification}</span>
            </div>
            <button onClick={() => setSuccessNotification(null)} className="text-emerald-600 hover:text-emerald-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/90 backdrop-blur-sm p-4 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ZONE SELECTOR CAROUSEL & QUICK STATS                                      */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              <span>Select Farm Zone ({unifiedZones.length} Total Parcels)</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Active Farm: <strong className="text-slate-800">{selectedFarm?.name || farm.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {unifiedZones.map((z) => {
              const isSelected = z.id === activeZone?.id;
              const zRisks = backendRisks.filter((r) => r.zone_id === z.id);
              const hasCrit = zRisks.some((r) => r.severity === "critical" || r.severity === "high");
              const hasWarn = zRisks.some((r) => r.severity === "low");
              const health = getZoneHealthBadge(z.status, hasCrit, hasWarn);

              return (
                <button
                  key={z.id}
                  onClick={() => setSelectedZoneId(z.id)}
                  className={`text-left p-3.5 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                    isSelected
                      ? "bg-emerald-50/80 border-emerald-500/80 shadow-md shadow-emerald-600/10 ring-2 ring-emerald-500/20"
                      : "bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/70 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                      {z.name}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${health.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                      {health.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Crop</span>
                      <span className="font-semibold text-slate-800 truncate block">{z.crop}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Area</span>
                      <span className="font-semibold text-slate-800">{z.areaHa} ha</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeZone && (
          <>
            {/* ========================================================================= */}
            {/* MODULE A & B: ACTIVE ZONE HEADER & STATUS                                 */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 md:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Zone Identity */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <Sprout className="h-5 w-5 text-emerald-600" />
                      <span>{activeZone.name}</span>
                    </h2>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${zoneHealth.badge}`}>
                      <span className={`w-2 h-2 rounded-full ${zoneHealth.dot}`} />
                      <ZoneHealthIcon className="h-3.5 w-3.5" />
                      <span>{zoneHealth.label}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      <Layers className="h-3 w-3 text-slate-500" />
                      <span>ID: {activeZone.id.slice(0, 8)}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>Farm: {selectedFarm?.name || farm.name} ({selectedFarm?.location || farm.district})</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Last Telemetry Sync: {formatRelativeTime(zoneMeasurements?.lastUpdate)}</span>
                    </span>
                  </p>
                </div>

                {/* Zone Management Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={openEditModal} className={btnSecondary} title="Edit Zone Details">
                    <Edit2 className="h-3.5 w-3.5 text-slate-600" />
                    <span>Edit Zone</span>
                  </button>
                  <button onClick={() => setShowChangeCropModal(true)} className={btnSecondary} title="Change Crop or Variety">
                    <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Change Crop</span>
                  </button>
                  <button onClick={() => setShowUpdateIrrigationModal(true)} className={btnSecondary} title="Update Irrigation System">
                    <Droplets className="h-3.5 w-3.5 text-blue-600" />
                    <span>Irrigation</span>
                  </button>
                  <button onClick={() => setShowConnectSensorModal(true)} className={btnSecondary} title="Attach Hardware Sensor">
                    <Cpu className="h-3.5 w-3.5 text-purple-600" />
                    <span>Connect Sensor</span>
                  </button>
                  <button
                    onClick={() => setShowDeleteZoneModal(true)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                    title="Delete Zone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Quick Spec Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-100">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Cultivated Crop</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 block truncate">{activeZone.crop}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Parcel Area</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 block">{activeZone.areaHa} Hectares</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Irrigation Method</span>
                  <span className="text-xs font-bold text-blue-700 mt-0.5 block">{activeZone.irrigation}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Soil Classification</span>
                  <span className="text-xs font-bold text-slate-900 mt-0.5 block truncate">{activeZone.soilType}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Growth Stage</span>
                  <span className="text-xs font-bold text-emerald-700 capitalize mt-0.5 block">{activeZone.cropStage || "Vegetative"}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Connected Sensors</span>
                  <span className="text-xs font-bold text-purple-700 mt-0.5 block">{zoneMeasurements?.sensorCount ?? 0} Node(s)</span>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* MODULE C: ZONE SENSOR / FIELD DATA (Key Differentiation from Farm Section) */}
            {/* ========================================================================= */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Zone Sensor & Field Measurements
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Field-Level Telemetry
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualReadingModal(true)}
                    className={btnSecondary}
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Record Field Reading</span>
                  </button>
                </div>
              </div>

              {/* Sensor Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Soil Moisture */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Droplets className="h-4 w-4 text-blue-600" />
                      <span>Soil Moisture</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${moistureStatus.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${moistureStatus.dot}`} />
                      {moistureStatus.text}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                      {zoneMeasurements?.soilMoisture != null ? `${zoneMeasurements.soilMoisture.toFixed(1)}%` : "—"}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">Volumetric (VWC)</span>
                  </div>

                  <div className="mt-3">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          moistureStatus.level === "critical"
                            ? "bg-rose-500"
                            : moistureStatus.level === "warning"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${zoneMeasurements?.soilMoisture != null ? Math.min(100, Math.max(5, zoneMeasurements.soilMoisture)) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>Dry (&lt;25%)</span>
                      <span>Target: 35-65%</span>
                      <span>Wet (&gt;80%)</span>
                    </div>
                  </div>
                </div>

                {/* 2. Soil pH & Soil EC */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-600" />
                      <span>Soil Chemistry</span>
                    </span>
                    {zoneMeasurements?.soilPh != null || zoneMeasurements?.soilEc != null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Measured
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                        No reading
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block">Soil pH</span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {zoneMeasurements?.soilPh != null ? zoneMeasurements.soilPh.toFixed(1) : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Ideal (6.0 - 7.5)</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block">Soil EC</span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {zoneMeasurements?.soilEc != null ? zoneMeasurements.soilEc.toFixed(2) : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">dS/m (Salinity)</span>
                    </div>
                  </div>
                </div>

                {/* 3. Temperatures (Soil & Air) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Thermometer className="h-4 w-4 text-rose-500" />
                      <span>Thermal Profile</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Subsoil + Ambient</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block">Soil Temp (15cm)</span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {zoneMeasurements?.soilTemp != null ? `${zoneMeasurements.soilTemp.toFixed(1)}°C` : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">15cm depth</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block">Air Temp</span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {zoneMeasurements?.airTemp != null ? `${zoneMeasurements.airTemp.toFixed(1)}°C` : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Humidity: {zoneMeasurements?.humidity != null ? `${zoneMeasurements.humidity.toFixed(0)}%` : "—"}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Rainfall & Water Stress Level */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Waves className="h-4 w-4 text-teal-600" />
                      <span>Water Balance</span>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Telemetry Node
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block">Daily Rainfall</span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {zoneMeasurements?.rainfall != null ? `${zoneMeasurements.rainfall.toFixed(1)} mm` : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Past 24h</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block">Hydraulic Head</span>
                      <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {zoneMeasurements?.waterLevel != null ? `${zoneMeasurements.waterLevel.toFixed(0)}%` : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 block">Canopy Saturation</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* MODULE D & E: ZONE CROP INTELLIGENCE & ZONE-LEVEL RISKS                   */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Module D: Crop Growth & Agronomic Stage */}
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Sprout className="h-4 w-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">Zone Crop Lifecycle</h3>
                  </div>
                  <button onClick={() => setShowChangeCropModal(true)} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                    Switch Crop
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-100 rounded-xl p-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">Cultivated Crop</span>
                      <span className="text-sm font-extrabold text-emerald-950">{activeZone.crop}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">Crop Health (NDVI)</span>
                      <span className="text-sm font-extrabold text-emerald-900">0.74 (Vigorous)</span>
                    </div>
                  </div>

                  {/* Growth Stage Stepper */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-600 block mb-2">Growth Progression Stage</span>
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {[
                        { key: "seedling", label: "Seedling" },
                        { key: "vegetative", label: "Vegetative" },
                        { key: "flowering", label: "Flowering" },
                        { key: "maturity", label: "Harvest" },
                      ].map((st, idx) => {
                        const currentStage = activeZone.cropStage || "vegetative";
                        const stages = ["seedling", "vegetative", "flowering", "maturity"];
                        const currentIdx = stages.indexOf(currentStage);
                        const isDone = currentIdx >= idx;
                        const isCurrent = currentStage === st.key;

                        return (
                          <div
                            key={st.key}
                            className={`p-2 rounded-xl text-[10px] font-bold border transition-all ${
                              isCurrent
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                : isDone
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-slate-50 text-slate-400 border-slate-200"
                            }`}
                          >
                            <span>{st.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Crop Agronomic Requirements */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 block">Est. Daily Irrigation</span>
                      <span className="text-xs font-bold text-blue-700 mt-0.5 block">4.8 mm / day (~48k L/ha)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 block">Expected Harvest</span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">In ~45 Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Module E: Zone Risks Matrix */}
              <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Zone-Specific Risks ({zoneRisks.length})
                    </h3>
                  </div>
                  <button
                    onClick={handleTriggerZoneRiskScan}
                    disabled={isScanningZoneRisks}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isScanningZoneRisks ? "animate-spin" : ""}`} />
                    <span>Re-evaluate Risks</span>
                  </button>
                </div>

                {zoneRisks.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-800">No active agronomic risks in this zone</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      All soil moisture, canopy temperatures, and nutrient indicators are within safe thresholds for {activeZone.crop}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {zoneRisks.map((risk) => {
                      const sev = getSeverityStyle(risk.severity);
                      const isEvaluating = evaluatingRiskId === risk.id;

                      return (
                        <div
                          key={risk.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sev.badge}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                                {risk.severity.toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-slate-900">
                                {formatRiskType(risk.risk_type)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {formatRelativeTime(risk.created_at)}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {(risk.evidence as { explanation?: string; primary_finding?: string; root_cause?: string } | null)?.explanation ||
                              (risk.evidence as { explanation?: string; primary_finding?: string; root_cause?: string } | null)?.primary_finding ||
                              `Telemetry indicators exceed safe baseline thresholds in ${activeZone.name}.`}
                          </p>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                            <span className="text-[10px] text-slate-500">
                              Agent: <strong>{risk.agent || "RiskDetectionEngine"}</strong> • Conf: {(risk.confidence * 100).toFixed(0)}%
                            </span>

                            <button
                              onClick={() => handleEvaluateWithAI(risk)}
                              disabled={isEvaluating}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              {isEvaluating ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Reasoning...</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="h-3 w-3" />
                                  <span>Evaluate with AI</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* MODULE F & G: ZONE AI ADVISORY & ACTION PLAN WORKFLOW                     */}
            {/* ========================================================================= */}
            {aiProposal && (
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/30 p-5 md:p-6 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-base font-extrabold text-slate-900">
                      Zone AI Agronomist Proposal ({activeZone.name})
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                      SafetyGuard Verified
                    </span>
                  </div>
                  <button onClick={() => setAiProposal(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-white border border-emerald-100 shadow-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnosed Problem</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 block">
                      {formatRiskType(aiProposal.risk.risk_type)} ({aiProposal.risk.severity.toUpperCase()})
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Rationale: {aiProposal.result.proposal.rationale || "Telemetry sensor deviation"}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-emerald-100 shadow-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Recommended Action</span>
                    <span className="text-xs font-bold text-emerald-800 mt-1 block">
                      {aiProposal.result.proposal.recommendation}
                    </span>
                    <span className="text-[11px] text-slate-600 mt-1 block">
                      Agent: <strong>{aiProposal.result.proposal.agent_type}</strong>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-emerald-100 shadow-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Execution & Impact</span>
                    <span className="text-xs font-bold text-slate-900 mt-1 block">
                      Priority: {aiProposal.result.proposal.urgency?.toUpperCase() || "HIGH"}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                      Confidence: {(aiProposal.result.proposal.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-emerald-100">
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      Human-in-the-loop: Approval creates an executable task assigned to farm operators.
                    </span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAiProposal(null)}
                      className={btnSecondary}
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={handleApproveAIProposal}
                      disabled={isSavingPlan}
                      className={btnPrimary}
                    >
                      {isSavingPlan ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Approving Plan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve & Create Action Plan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Zone Action Plans & Tasks Tracker */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Zone Tasks & Action Plan Execution ({zoneTasks.length})
                  </h3>
                </div>
                <Link href="/tasks" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                  View Full Task Pipeline →
                </Link>
              </div>

              {zoneTasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No pending field tasks for this zone. Approve an AI Advisory or create a manual task.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {zoneTasks.map((t) => {
                    const isDone = t.status === "completed";
                    const isInProgress = t.status === "in_progress";

                    return (
                      <div
                        key={t.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDone
                              ? "bg-emerald-100 text-emerald-800"
                              : isInProgress
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {t.status.toUpperCase()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Due: {formatIST(t.due_until)}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900">{t.title}</h4>
                        {t.description && (
                          <p className="text-[11px] text-slate-600 line-clamp-2">{t.description}</p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
                          <span className="text-slate-500">
                            Assignee: <strong className="text-slate-700">{t.assignee_id || "Field Operator"}</strong>
                          </span>

                          <div className="flex items-center gap-1.5">
                            {!isDone && (
                              <button
                                onClick={async () => {
                                  await apiCompleteTask(t.id, { completion_notes: "Completed via Zone Console" });
                                  await refreshBackendState();
                                  setSuccessNotification(`Task "${t.title}" completed!`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700"
                              >
                                Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* MODULE H: ZONE HISTORY (Telemetry, Risks, AI Recommendations, Field Ops) */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Zone Historical Log & Time-Series Data
                  </h3>
                </div>

                {/* History Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {[
                    { key: "telemetry", label: "Sensor Readings" },
                    { key: "risks", label: "Past Risks" },
                    { key: "advisory", label: "AI Advisories" },
                    { key: "tasks", label: "Field Tasks" },
                  ].map((tb) => (
                    <button
                      key={tb.key}
                      onClick={() => setHistoryTab(tb.key as any)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        historyTab === tb.key
                          ? "bg-white text-slate-900 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tb.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab 1: Sensor Readings Log */}
              {historyTab === "telemetry" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Soil Moisture</th>
                        <th className="py-2.5 px-3">Soil Temp</th>
                        <th className="py-2.5 px-3">Soil pH</th>
                        <th className="py-2.5 px-3">Air Temp / Humidity</th>
                        <th className="py-2.5 px-3">Quality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {zoneTelemetryEvents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            No telemetry logs recorded yet. Click "Record Field Reading" or connect a hardware node.
                          </td>
                        </tr>
                      ) : (
                        zoneTelemetryEvents.slice(0, 8).map((evt) => {
                          const m = evt.measurements || {};
                          return (
                            <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {formatIST(evt.event_at)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-blue-700">
                                {((m.soil_moisture as number) ?? evt.value)?.toFixed(1)}%
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {((m.soil_temp as number) ?? 24.5).toFixed(1)}°C
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {((m.ph as number) ?? 6.4).toFixed(1)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">
                                {((m.air_temp as number) ?? 28.0).toFixed(1)}°C / {((m.humidity as number) ?? 60).toFixed(0)}%
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {evt.quality || "GOOD"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Past Risks Log */}
              {historyTab === "risks" && (
                <div className="space-y-2">
                  {zoneRisks.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No past risks recorded for this zone.</p>
                  ) : (
                    zoneRisks.map((r) => (
                      <div key={r.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 block">{formatRiskType(r.risk_type)}</span>
                          <span className="text-[10px] text-slate-500">Status: {r.status} • Detected: {formatIST(r.created_at)}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 uppercase">
                          {r.severity}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: AI Advisories */}
              {historyTab === "advisory" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-800">Zone Agronomic Intelligence Record</p>
                  <p className="text-[11px] text-slate-500">
                    AI evaluations leverage real-time edge telemetry combined with research agronomic benchmarks to generate bounded prescriptions.
                  </p>
                </div>
              )}

              {/* Tab 4: Field Tasks */}
              {historyTab === "tasks" && (
                <div className="space-y-2">
                  {zoneTasks.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No field tasks logged yet.</p>
                  ) : (
                    zoneTasks.map((t) => (
                      <div key={t.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 block">{t.title}</span>
                          <span className="text-[10px] text-slate-500">Assignee: {t.assignee_id || "Self"} • Due: {formatIST(t.due_until)}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          {t.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* MODALS: ADD, EDIT, DELETE ZONE, CONNECT SENSOR, CHANGE CROP, MANUAL READ  */}
        {/* ========================================================================= */}

        {/* 1. Add Zone Modal */}
        {showAddZoneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-600" />
                  <span>Add New Farm Zone</span>
                </h3>
                <button onClick={() => setShowAddZoneModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateZone} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    value={formZoneName}
                    onChange={(e) => setFormZoneName(e.target.value)}
                    placeholder="e.g. East Ridge - Orchard"
                    className={inputStyle}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Parcel Area (ha)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formZoneArea}
                      onChange={(e) => setFormZoneArea(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Crop</label>
                    <input
                      type="text"
                      required
                      value={formZoneCrop}
                      onChange={(e) => setFormZoneCrop(e.target.value)}
                      placeholder="e.g. Sugarcane"
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil Type</label>
                    <input
                      type="text"
                      value={formZoneSoil}
                      onChange={(e) => setFormZoneSoil(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Irrigation Method</label>
                    <select
                      value={formZoneIrrigation}
                      onChange={(e) => setFormZoneIrrigation(e.target.value as any)}
                      className={inputStyle}
                    >
                      <option value="Drip">Drip</option>
                      <option value="Sprinkler">Sprinkler</option>
                      <option value="Flood / Furrow">Flood / Furrow</option>
                      <option value="Rainfed">Rainfed</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowAddZoneModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingZone} className={btnPrimary}>
                    {isSubmittingZone ? "Creating Zone..." : "Create Zone"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Edit Zone Modal */}
        {showEditZoneModal && activeZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit2 className="h-4 w-4 text-emerald-600" />
                  <span>Edit Zone: {activeZone.name}</span>
                </h3>
                <button onClick={() => setShowEditZoneModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditZone} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Zone Name</label>
                  <input
                    type="text"
                    required
                    value={formZoneName}
                    onChange={(e) => setFormZoneName(e.target.value)}
                    className={inputStyle}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Area (ha)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={formZoneArea}
                      onChange={(e) => setFormZoneArea(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Crop</label>
                    <input
                      type="text"
                      required
                      value={formZoneCrop}
                      onChange={(e) => setFormZoneCrop(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil Type</label>
                    <input
                      type="text"
                      value={formZoneSoil}
                      onChange={(e) => setFormZoneSoil(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Irrigation</label>
                    <select
                      value={formZoneIrrigation}
                      onChange={(e) => setFormZoneIrrigation(e.target.value as any)}
                      className={inputStyle}
                    >
                      <option value="Drip">Drip</option>
                      <option value="Sprinkler">Sprinkler</option>
                      <option value="Flood / Furrow">Flood / Furrow</option>
                      <option value="Rainfed">Rainfed</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowEditZoneModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingZone} className={btnPrimary}>
                    {isSubmittingZone ? "Saving Changes..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. Delete Zone Modal */}
        {showDeleteZoneModal && activeZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 rounded-full bg-rose-50 border border-rose-200">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Zone?</h3>
                  <p className="text-xs text-slate-500">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete <strong>{activeZone.name}</strong> ({activeZone.areaHa} ha, {activeZone.crop})?
                All associated zone sensor events, telemetry caches, and active tasks will be safely unlinked.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => setShowDeleteZoneModal(false)} className={btnSecondary}>
                  Cancel
                </button>
                <button onClick={handleDeleteZone} disabled={isSubmittingZone} className={btnDanger}>
                  {isSubmittingZone ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Connect Sensor / Hardware Node Modal */}
        {showConnectSensorModal && activeZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple-600" />
                  <span>Connect Sensor Node to {activeZone.name}</span>
                </h3>
                <button onClick={() => setShowConnectSensorModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleConnectSensor} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Hardware Device Type</label>
                  <select
                    value={sensorType}
                    onChange={(e) => setSensorType(e.target.value as any)}
                    className={inputStyle}
                  >
                    <option value="soil_sensor">Multi-Depth Soil Moisture & pH Probe</option>
                    <option value="weather_station">Microclimate Weather Station Node</option>
                    <option value="multispectral_camera">Canopy Multispectral Sensor</option>
                    <option value="gateway">LoRaWAN Edge Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Device Identifier / Credential Ref (Optional)
                  </label>
                  <input
                    type="text"
                    value={sensorRef}
                    onChange={(e) => setSensorRef(e.target.value)}
                    placeholder="e.g. LORA-SOIL-NODE-04"
                    className={inputStyle}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty to auto-generate edge node credentials.</p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowConnectSensorModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isConnectingSensor} className={btnPrimary}>
                    {isConnectingSensor ? "Connecting Node..." : "Connect Sensor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. Change Crop Modal */}
        {showChangeCropModal && activeZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  <span>Change Crop: {activeZone.name}</span>
                </h3>
                <button onClick={() => setShowChangeCropModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleChangeCrop} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">New Crop / Variety</label>
                  <input
                    type="text"
                    required
                    value={formZoneCrop}
                    onChange={(e) => setFormZoneCrop(e.target.value)}
                    placeholder="e.g. Mustard, Banana, Chickpea"
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Growth Stage</label>
                  <select
                    value={formCropStage}
                    onChange={(e) => setFormCropStage(e.target.value)}
                    className={inputStyle}
                  >
                    <option value="seedling">Seedling</option>
                    <option value="vegetative">Vegetative</option>
                    <option value="flowering">Flowering</option>
                    <option value="maturity">Maturity / Harvest</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowChangeCropModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingZone} className={btnPrimary}>
                    {isSubmittingZone ? "Updating..." : "Update Crop"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. Update Irrigation Modal */}
        {showUpdateIrrigationModal && activeZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-blue-600" />
                  <span>Update Irrigation: {activeZone.name}</span>
                </h3>
                <button onClick={() => setShowUpdateIrrigationModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateIrrigation} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Irrigation System</label>
                  <select
                    value={formZoneIrrigation}
                    onChange={(e) => setFormZoneIrrigation(e.target.value as any)}
                    className={inputStyle}
                  >
                    <option value="Drip">Drip Irrigation (High Precision)</option>
                    <option value="Sprinkler">Micro-Sprinkler Overhead</option>
                    <option value="Flood / Furrow">Flood / Furrow Irrigation</option>
                    <option value="Rainfed">Rainfed / Dryland</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowUpdateIrrigationModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingZone} className={btnPrimary}>
                    {isSubmittingZone ? "Updating..." : "Save System"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 7. Record Manual Field Reading Modal */}
        {showManualReadingModal && activeZone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <span>Record Field Telemetry Reading ({activeZone.name})</span>
                </h3>
                <button onClick={() => setShowManualReadingModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleRecordReading} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil Moisture (% VWC)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={manualMoisture}
                      onChange={(e) => setManualMoisture(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil pH (0-14)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={manualPh}
                      onChange={(e) => setManualPh(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Soil Temperature (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={manualTemp}
                      onChange={(e) => setManualTemp(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Ambient Humidity (%)</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={manualHumidity}
                      onChange={(e) => setManualHumidity(e.target.value)}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button type="button" onClick={() => setShowManualReadingModal(false)} className={btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmittingReading} className={btnPrimary}>
                    {isSubmittingReading ? "Recording Ingestion..." : "Submit Reading"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    </AppShell>
  );
}

export default function ZonesPage() {
  return (
    <React.Suspense
      fallback={
        <AppShell title="Crop Zones Management">
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-2 text-emerald-600" />
            Loading crop zones...
          </div>
        </AppShell>
      }
    >
      <ZonesPageContent />
    </React.Suspense>
  );
}
