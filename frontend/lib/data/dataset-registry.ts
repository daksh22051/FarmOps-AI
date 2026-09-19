export type DatasetIntakeStatus = "not-downloaded" | "downloaded";
export type DatasetVerificationStatus = "unverified" | "structurally-inspected";
export type DatasetIntegrationStatus = "not-implemented" | "adapter-implemented" | "dashboard-connected";
export type DatasetCleaningStatus = "proposed-not-executed";

export interface DatasetRegistryEntry {
  readonly id: string;
  readonly name: string;
  readonly sourceUrl: string;
  readonly intendedPurpose: string;
  readonly intakeStatus: DatasetIntakeStatus;
  readonly verificationStatus: DatasetVerificationStatus;
  readonly integrationStatus: DatasetIntegrationStatus;
  readonly cleaningStatus: DatasetCleaningStatus;
  readonly localPaths: readonly string[];
  readonly inspectionSummary: readonly string[];
}

// Inspection snapshot: docs/datasets/README.md, 2026-09-19.
// These are separate static sources, not live telemetry from one farm.
// Structural inspection does not verify provenance, diagnoses, or license terms.
// Source attribution and license review remain required before integration/sharing.
export const datasetRegistry = [
  {
    id: "field-scale-soil-moisture",
    name: "Soil Moisture Data from Field Scale Sensor Network",
    sourceUrl: "https://www.kaggle.com/datasets/sathyanarayanrao89/soil-moisture-data-from-field-scale-sensor-network",
    intendedPurpose: "Future evaluation of verified soil-moisture observations for condition-history and monitoring experiences.",
    intakeStatus: "downloaded",
    verificationStatus: "structurally-inspected",
    integrationStatus: "dashboard-connected",
    cleaningStatus: "proposed-not-executed",
    localPaths: ["data/raw/soil-moisture/Daily/", "data/raw/soil-moisture/Hourly/"],
    inspectionSummary: [
      "42 Daily and 42 Hourly tab-delimited .txt files.",
      "Daily: 140,532 rows; 645,405 missing measurement cells; zero duplicate rows.",
      "Hourly: 3,373,658 rows; 15,648,564 missing cells, including missing dates and times; 889 duplicate rows.",
      "Hourly/CAF201.txt: 890 trailing rows retain Location=CAF201 but lack date, time, and all measurements; 889 are duplicates beyond the first.",
      "VW and T measurement definitions and units remain undocumented locally; station geography and timezone are unresolved.",
    ],
  },
  {
    id: "crop-recommendation",
    name: "Crop Recommendation Dataset",
    sourceUrl: "https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset",
    intendedPurpose: "Future evaluation for crop-advisory workflows after source fields and limitations are verified.",
    intakeStatus: "downloaded",
    verificationStatus: "structurally-inspected",
    integrationStatus: "dashboard-connected",
    cleaningStatus: "proposed-not-executed",
    localPaths: ["data/raw/crop-recommendation/Crop_recommendation.csv"],
    inspectionSummary: [
      "CSV: 2,200 rows; eight columns; zero missing cells; zero duplicate rows.",
      "22 source labels, each with 100 records.",
      "Measurement units are not documented locally; whether records are observed or generated remains unresolved.",
    ],
  },
  {
    id: "plantvillage",
    name: "PlantVillage Dataset",
    sourceUrl: "https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset",
    intendedPurpose: "Future evaluation of image data for plant-health research and advisory experiences.",
    intakeStatus: "downloaded",
    verificationStatus: "structurally-inspected",
    integrationStatus: "dashboard-connected",
    cleaningStatus: "proposed-not-executed",
    localPaths: ["data/raw/plantvillage/plantvillage dataset/"],
    inspectionSummary: [
      "162,916 images: color 54,305; grayscale 54,305; segmented 54,306; 38 source-provided directory labels per variant.",
      "Segmented Grape___Esca_(Black_Measles) has 1,384 images versus 1,383 in each other variant; pairing remains unverified.",
      "Directory labels are not independently verified diagnoses. Exhaustive image decoding and duplicate-image checks were not reported.",
    ],
  },
  {
    id: "edge-assisted-agricultural-sensors",
    name: "Edge Assisted Agricultural Sensor Dataset",
    sourceUrl: "https://www.kaggle.com/datasets/colabsss/edge-assisted-agricultural-sensor-dataset",
    intendedPurpose: "Future evaluation of sensor and environmental-data integration patterns.",
    intakeStatus: "downloaded",
    verificationStatus: "structurally-inspected",
    integrationStatus: "dashboard-connected",
    cleaningStatus: "proposed-not-executed",
    localPaths: [
      "data/raw/edge-agricultural-sensor/agriculture_dataset_with_target.csv",
      "data/raw/edge-agricultural-sensor/Images/Agricultural-crops/",
    ],
    inspectionSummary: [
      "CSV: 2,000 rows; 12 columns; zero missing cells; zero duplicate rows; unique hourly timestamps with unspecified timezone.",
      "Three source Crop_Health values: High_Stress (688), Healthy (679), Moderate_Stress (633); not independently verified diagnoses.",
      "Separate image tree: 829 images across 30 crop-named directories; no manifest links images to CSV records.",
      "Only 5G_Latency_ms states a measurement unit in its header; other measurement units and record-generation provenance remain unresolved.",
    ],
  },
] as const satisfies readonly DatasetRegistryEntry[];
