import { CropRecommendationAdapter, getCropDatasetSummary } from "./crop-adapter";
import { EdgeSensorAdapter, getEdgeSensorSummary } from "./edge-sensor-adapter";
import { EdgeImagesAdapter, getEdgeImagesInventory } from "./edge-images-adapter";
import { PlantVillageAdapter, getPlantVillageInventory } from "./plantvillage-adapter";
import { SoilDailyAdapter, getSoilDailyStationSummary, SOIL_STATIONS } from "./soil-daily-adapter";
import { SoilHourlyAdapter } from "./soil-hourly-adapter";
import type { AdapterQuery } from "../dataset-adapter";

export {
  SOIL_STATIONS,
  CropRecommendationAdapter,
  EdgeSensorAdapter,
  EdgeImagesAdapter,
  PlantVillageAdapter,
  SoilDailyAdapter,
  SoilHourlyAdapter,
};

export interface DashboardDatasetBundle {
  readonly timestamp: string;
  readonly datasetStatuses: Array<{
    readonly id: string;
    readonly name: string;
    readonly sourceUrl: string;
    readonly intakeStatus: string;
    readonly verificationStatus: string;
    readonly integrationStatus: string;
    readonly assetCountDescription: string;
    readonly verifiedRecordsCount: number;
    readonly limitationsCount: number;
  }>;
  readonly cropSummary: ReturnType<typeof getCropDatasetSummary>;
  readonly edgeSensorSummary: ReturnType<typeof getEdgeSensorSummary>;
  readonly edgeImagesInventory: ReturnType<typeof getEdgeImagesInventory>;
  readonly plantVillageInventory: ReturnType<typeof getPlantVillageInventory>;
  readonly soilDailySampleSummary: ReturnType<typeof getSoilDailyStationSummary>;
  readonly stations: readonly string[];
}

/**
 * Prepares the server-side dashboard dataset bundle.
 * This runs strictly on the Node server during SSR/page render.
 */
export async function getDashboardDatasetBundle(): Promise<DashboardDatasetBundle> {
  const cropSummary = getCropDatasetSummary();
  const edgeSensorSummary = getEdgeSensorSummary();
  const edgeImagesInventory = getEdgeImagesInventory();
  const plantVillageInventory = getPlantVillageInventory();
  const soilDailySampleSummary = getSoilDailyStationSummary("CAF003");

  const datasetStatuses = [
    {
      id: "crop-recommendation",
      name: "Crop Recommendation Dataset",
      sourceUrl: "https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset",
      intakeStatus: "downloaded",
      verificationStatus: "structurally-inspected",
      integrationStatus: "dashboard-connected",
      assetCountDescription: "2,200 rows across 8 columns (22 crop classes, 100 rows each)",
      verifiedRecordsCount: cropSummary?.totalRecords ?? 2200,
      limitationsCount: 3,
    },
    {
      id: "edge-assisted-agricultural-sensors",
      name: "Edge Assisted Agricultural Sensor Dataset",
      sourceUrl: "https://www.kaggle.com/datasets/colabsss/edge-assisted-agricultural-sensor-dataset",
      intakeStatus: "downloaded",
      verificationStatus: "structurally-inspected",
      integrationStatus: "dashboard-connected",
      assetCountDescription: "2,000 sensor rows & 829 crop images across 30 directories",
      verifiedRecordsCount: edgeSensorSummary?.totalRecords ?? 2000,
      limitationsCount: 4,
    },
    {
      id: "plantvillage",
      name: "PlantVillage Dataset",
      sourceUrl: "https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset",
      intakeStatus: "downloaded",
      verificationStatus: "structurally-inspected",
      integrationStatus: "dashboard-connected",
      assetCountDescription: "162,916 images across 3 variants (color, grayscale, segmented; 38 classes)",
      verifiedRecordsCount: plantVillageInventory?.totalImages ?? 162916,
      limitationsCount: 3,
    },
    {
      id: "field-scale-soil-moisture",
      name: "Soil Moisture Data from Field Scale Sensor Network",
      sourceUrl: "https://www.kaggle.com/datasets/sathyanarayanrao89/soil-moisture-data-from-field-scale-sensor-network",
      intakeStatus: "downloaded",
      verificationStatus: "structurally-inspected",
      integrationStatus: "dashboard-connected",
      assetCountDescription: "42 Daily (140,532 rows) & 42 Hourly (3,373,658 rows) tab-delimited files",
      verifiedRecordsCount: 3514190, // 140,532 + 3,373,658
      limitationsCount: 4,
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    datasetStatuses,
    cropSummary,
    edgeSensorSummary,
    edgeImagesInventory,
    plantVillageInventory,
    soilDailySampleSummary,
    stations: SOIL_STATIONS,
  };
}

export type GenericAdapterResult =
  | Awaited<ReturnType<CropRecommendationAdapter["load"]>>
  | Awaited<ReturnType<EdgeSensorAdapter["load"]>>
  | Awaited<ReturnType<EdgeImagesAdapter["load"]>>
  | Awaited<ReturnType<PlantVillageAdapter["load"]>>
  | Awaited<ReturnType<SoilDailyAdapter["load"]>>
  | Awaited<ReturnType<SoilHourlyAdapter["load"]>>;

/**
 * Universal query runner for paginated / filtered dataset exploration.
 */
export async function loadDatasetRecords(
  datasetKey: string,
  query?: AdapterQuery
): Promise<GenericAdapterResult> {
  switch (datasetKey) {
    case "crop-recommendation": {
      const adapter = new CropRecommendationAdapter();
      return adapter.load(query);
    }
    case "edge-sensor-csv": {
      const adapter = new EdgeSensorAdapter();
      return adapter.load(query);
    }
    case "edge-images": {
      const adapter = new EdgeImagesAdapter();
      return adapter.load(query);
    }
    case "plantvillage": {
      const adapter = new PlantVillageAdapter(query?.variant ?? "color");
      return adapter.load(query);
    }
    case "soil-daily": {
      const adapter = new SoilDailyAdapter();
      return adapter.load(query);
    }
    case "soil-hourly": {
      const adapter = new SoilHourlyAdapter();
      return adapter.load(query);
    }
    default:
      throw new Error(`Unknown dataset key: ${datasetKey}`);
  }
}
