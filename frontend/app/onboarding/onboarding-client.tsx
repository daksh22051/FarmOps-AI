"use client";

import React, { useState, useEffect } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Check, Leaf } from "lucide-react";
import { useFarm } from "../../context/farm-context";
import { createFarm, createZone } from "../../lib/api/farmops";
import type { FarmCreate } from "../../types/api";

// Sub-step components
import { StepWelcomeProfile, type FarmerProfileData } from "./step-welcome-profile";
import { StepFarmDetails, type FarmDetailsData } from "./step-farm-details";
import { StepFarmLocation, type FarmLocationData } from "./step-farm-location";
import { StepFarmSize, type FarmSizeData } from "./step-farm-size";
import { StepZoneSetup, type ZoneConfigItem } from "./step-zone-setup";
import { StepReviewFarm } from "./step-review-farm";

const STEPS = [
  { id: 1, name: "Profile" },
  { id: 2, name: "Farm Details" },
  { id: 3, name: "Location" },
  { id: 4, name: "Size" },
  { id: 5, name: "Zones" },
  { id: 6, name: "Review" },
];

export default function OnboardingClient() {
  const router = useRouter();
  const { currentUser, refreshFarms, selectFarm } = useFarm();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  // 1. Farmer Profile Data
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfileData>({
    fullName: "",
    phone: "",
    role: "owner",
    profilePhoto: null,
  });

  // 2. Farm Basic Details Data
  const [farmDetails, setFarmDetails] = useState<FarmDetailsData>({
    farmName: "",
    farmType: "Crop Farm",
    primaryCrop: "Wheat",
    secondaryCrops: [],
  });

  // 3. Farm Location Data
  const [locationData, setLocationData] = useState<FarmLocationData>({
    villageCity: "",
    district: "",
    state: "",
    country: "India",
    latitude: null,
    longitude: null,
    formattedAddress: "",
    farmImage: null,
  });

  // 4. Farm Size Data
  const [sizeData, setSizeData] = useState<FarmSizeData>({
    area: 5.2,
    areaUnit: "acres",
    addBoundaryLater: true,
  });

  // 5. Zones Data
  const [zones, setZones] = useState<ZoneConfigItem[]>([
    {
      id: "zone-a",
      name: "Zone A",
      crop: "Wheat",
      area: 2.0,
      soilType: "Loamy Soil",
      irrigationType: "Drip",
    },
    {
      id: "zone-b",
      name: "Zone B",
      crop: "Cotton",
      area: 1.8,
      soilType: "Clay Loam",
      irrigationType: "Sprinkler",
    },
    {
      id: "zone-c",
      name: "Zone C",
      crop: "Wheat",
      area: 1.4,
      soilType: "Loamy Soil",
      irrigationType: "Drip",
    },
  ]);

  // Pre-fill user profile if authenticated
  useEffect(() => {
    if (currentUser) {
      const name =
        (currentUser.user_metadata?.full_name as string) ||
        (currentUser.user_metadata?.name as string) ||
        (currentUser.email ? currentUser.email.split("@")[0] : "");
      if (name && !farmerProfile.fullName) {
        setFarmerProfile((prev) => ({ ...prev, fullName: name }));
      }
    }
  }, [currentUser]);

  // Handle final farm creation and persistence
  const handleCreateFarm = async () => {
    setIsCreating(true);

    try {
      // 1. Build FarmCreate payload
      const farmPayload: FarmCreate = {
        name: farmDetails.farmName.trim() || "My Farm",
        location: locationData.villageCity || "Ahmedabad",
        address: locationData.formattedAddress || `${locationData.villageCity}, ${locationData.district}, ${locationData.state}, India`,
        timezone: "Asia/Kolkata",
        total_area: sizeData.area,
        area_unit: sizeData.areaUnit,
        boundary_geometry:
          locationData.latitude && locationData.longitude
            ? {
                type: "Point" as const,
                coordinates: [locationData.longitude, locationData.latitude],
              }
            : undefined,
        crop_profile: {
          farm_type: farmDetails.farmType,
          primary_crop: farmDetails.primaryCrop,
          secondary_crops: farmDetails.secondaryCrops,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          district: locationData.district,
          state: locationData.state,
          country: locationData.country,
          farmer_name: farmerProfile.fullName,
          phone: farmerProfile.phone,
          farm_image: locationData.farmImage || undefined,
        },
        is_demo: false,
      };

      // 2. Persist Farm to backend
      let createdFarmId: string | null = null;
      try {
        const res = await createFarm(farmPayload);
        if (res.data?.id) {
          createdFarmId = res.data.id;

          // 3. Create Zones under the newly created farm
          for (const z of zones) {
            await createZone(createdFarmId, {
              name: z.name,
              crop: z.crop,
              area: z.area,
              area_unit: sizeData.areaUnit,
              soil_type: z.soilType || "Loamy Soil",
              status: "active",
            }).catch((err) => console.warn("Zone creation note:", err));
          }

          // 4. Refresh FarmContext and select the new farm
          await refreshFarms();
          await selectFarm(createdFarmId);
        }
      } catch (backendErr) {
        console.warn("Backend farm creation notice, applying local cache:", backendErr);
        createdFarmId = `farm-${Date.now()}`;
      }

      // 5. Save in localStorage for immediate client-side responsiveness
      if (typeof window !== "undefined") {
        const customFarmData = {
          id: createdFarmId || `farm-${Date.now()}`,
          name: farmDetails.farmName,
          location: `${locationData.villageCity}, ${locationData.state}`,
          district: locationData.district,
          state: locationData.state,
          country: locationData.country,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          total_area: sizeData.area,
          area_unit: sizeData.areaUnit,
          primary_crop: farmDetails.primaryCrop,
          farm_image: locationData.farmImage || null,
          zones: zones.map((z) => ({
            id: z.id,
            name: z.name,
            crop: z.crop,
            areaHa: sizeData.areaUnit === "acres" ? Math.round((z.area / 2.47105) * 10) / 10 : z.area,
            soilType: z.soilType || "Loam",
            status: "Good",
          })),
        };
        localStorage.setItem("farmops_custom_farm", JSON.stringify(customFarmData));
        localStorage.setItem("farmops_selected_farm_id", customFarmData.id);
      }

      // 6. Redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to complete farm creation:", err);
      router.push("/dashboard");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7faf8] flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <NextLink href="/dashboard" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-800 flex items-center justify-center text-white shadow-xs">
            <Leaf size={18} className="fill-current text-emerald-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-slate-900 leading-none">
              FarmOps <span className="text-emerald-700">AI</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400 leading-tight">
              Farmer Onboarding
            </span>
          </div>
        </NextLink>

        {/* Step Numbers Indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((step) => {
            const isDone = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : isCurrent
                      ? "bg-emerald-100 text-emerald-900 ring-2 ring-emerald-600/30 font-extrabold"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isDone ? <Check size={13} strokeWidth={3} /> : step.id}
                </div>
                {step.id < STEPS.length && (
                  <div
                    className={`w-4 sm:w-8 h-0.5 mx-1 transition-all ${
                      isDone ? "bg-emerald-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Step 1: Farmer Profile */}
        {currentStep === 1 && (
          <StepWelcomeProfile
            data={farmerProfile}
            onChange={(up) => setFarmerProfile((prev) => ({ ...prev, ...up }))}
            onNext={() => setCurrentStep(2)}
          />
        )}

        {/* Step 2: Farm Details */}
        {currentStep === 2 && (
          <StepFarmDetails
            data={farmDetails}
            onChange={(up) => setFarmDetails((prev) => ({ ...prev, ...up }))}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {/* Step 3: Farm Location */}
        {currentStep === 3 && (
          <StepFarmLocation
            data={locationData}
            onChange={(up) => setLocationData((prev) => ({ ...prev, ...up }))}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {/* Step 4: Farm Size */}
        {currentStep === 4 && (
          <StepFarmSize
            data={sizeData}
            onChange={(up) => setSizeData((prev) => ({ ...prev, ...up }))}
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
          />
        )}

        {/* Step 5: Zone Setup */}
        {currentStep === 5 && (
          <StepZoneSetup
            totalFarmArea={sizeData.area}
            areaUnit={sizeData.areaUnit}
            primaryCrop={farmDetails.primaryCrop}
            secondaryCrops={farmDetails.secondaryCrops}
            zones={zones}
            onChange={setZones}
            onNext={() => setCurrentStep(6)}
            onBack={() => setCurrentStep(4)}
          />
        )}

        {/* Step 6: Review & Create Farm */}
        {currentStep === 6 && (
          <StepReviewFarm
            farmerProfile={farmerProfile}
            farmDetails={farmDetails}
            locationData={locationData}
            sizeData={sizeData}
            zones={zones}
            isCreating={isCreating}
            onEdit={(stepIdx) => setCurrentStep(stepIdx)}
            onCreateFarm={handleCreateFarm}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/70 py-4 px-6 text-center text-xs text-slate-500">
        <span>Smart Farms. Brighter Tomorrows. Powered by FarmOps AI.</span>
      </footer>
    </div>
  );
}
