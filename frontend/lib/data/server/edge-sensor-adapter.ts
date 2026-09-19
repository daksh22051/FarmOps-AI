import fs from "node:fs";
import { resolveSafeRawPath, sanitizeRepoPath } from "./path-utils";
import { parseDelimitedLine, streamDelimitedFile, parseDatasetNumber, parseDatasetString } from "./rfc4180-parser";
import { datasetRegistry, type DatasetRegistryEntry } from "../dataset-registry";
import type {
  AdapterQuery,
  AdapterResult,
  DatasetAdapter,
  DatasetProvenance,
  DatasetValidation,
  DatasetValue,
  RawDataset,
  SourceReference,
  ValidationIssue,
} from "../dataset-adapter";

const SOURCE_CONFIG = {
  datasetId: "edge-assisted-agricultural-sensors" as const,
  asset: "csv" as const,
  relativePath: "edge-agricultural-sensor/agriculture_dataset_with_target.csv",
  expectedColumns: [
    "Record_ID",
    "Timestamp",
    "Soil_Moisture",
    "Soil_Temperature",
    "Soil_pH",
    "Humidity",
    "Air_Temperature",
    "Solar_Radiation",
    "Wind_Speed",
    "NDVI_Index",
    "5G_Latency_ms",
    "Crop_Health",
  ] as const,
  expectedTotalRecords: 2000,
  expectedLabels: ["Healthy", "High_Stress", "Moderate_Stress"] as const,
};

export interface EdgeSensorRecordPayload {
  readonly recordId: DatasetValue<number>;
  readonly timestamp: DatasetValue<string>;
  readonly soilMoisture: DatasetValue<number>;
  readonly soilTemperature: DatasetValue<number>;
  readonly soilPh: DatasetValue<number>;
  readonly humidity: DatasetValue<number>;
  readonly airTemperature: DatasetValue<number>;
  readonly solarRadiation: DatasetValue<number>;
  readonly windSpeed: DatasetValue<number>;
  readonly ndviIndex: DatasetValue<number>;
  readonly latencyMs5G: DatasetValue<number>;
  readonly cropHealth: DatasetValue<string>;
}

export interface EdgeSensorSummary {
  readonly totalRecords: number;
  readonly dateRange: {
    start: string;
    end: string;
  };
  readonly cropHealthDistribution: {
    Healthy: number;
    Moderate_Stress: number;
    High_Stress: number;
  };
  readonly averageLatencyMs: number;
  readonly fieldAverages: {
    soilMoisture: number;
    soilTemperature: number;
    soilPh: number;
    humidity: number;
    airTemperature: number;
    solarRadiation: number;
    windSpeed: number;
    ndviIndex: number;
  };
}

export function getEdgeSensorProvenance(): DatasetProvenance<typeof SOURCE_CONFIG> {
  const fullPath = resolveSafeRawPath(SOURCE_CONFIG.relativePath);
  const metadata = datasetRegistry.find((d) => d.id === SOURCE_CONFIG.datasetId) as Extract<
    DatasetRegistryEntry,
    { id: "edge-assisted-agricultural-sensors" }
  >;

  return {
    source: SOURCE_CONFIG,
    metadata,
    context: "static-dataset",
    inspectionReport: "docs/datasets/README.md",
    sourceVersion: null,
    attribution: "Kaggle: colabsss/edge-assisted-agricultural-sensor-dataset",
    licenseReview: {
      status: "not-reviewed",
    },
    limitations: [
      "Only 5G_Latency_ms explicitly defines its unit (ms) in the column header; other numeric units remain undocumented.",
      "Timestamp range covers 2024-01-01 00:00:00 to 2024-03-24 07:00:00 with no stated timezone.",
      "Crop_Health values are source-provided categorical labels, not independently verified botanical or agronomic diagnoses.",
      "No proven foreign-key manifest links these sensor rows to the 829 crop images in the sibling directory.",
    ],
    files: [
      {
        path: sanitizeRepoPath(fullPath),
        sha256: null,
      },
    ],
  };
}

/**
 * Computes descriptive summary of the 2,000 edge sensor records.
 */
export function getEdgeSensorSummary(): EdgeSensorSummary | null {
  try {
    const fullPath = resolveSafeRawPath(SOURCE_CONFIG.relativePath);
    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return null;

    const healthDist: Record<string, number> = { Healthy: 0, Moderate_Stress: 0, High_Stress: 0 };
    let firstTimestamp = "";
    let lastTimestamp = "";
    let count = 0;

    let sumMoisture = 0;
    let sumSoilTemp = 0;
    let sumPh = 0;
    let sumHum = 0;
    let sumAirTemp = 0;
    let sumRad = 0;
    let sumWind = 0;
    let sumNdvi = 0;
    let sumLatency = 0;

    for (let i = 1; i < lines.length; i++) {
      const tokens = parseDelimitedLine(lines[i], ",");
      if (tokens.length < 12) continue;

      const ts = tokens[1].trim();
      if (!firstTimestamp) firstTimestamp = ts;
      lastTimestamp = ts;

      const sm = Number(tokens[2]);
      const st = Number(tokens[3]);
      const ph = Number(tokens[4]);
      const hum = Number(tokens[5]);
      const at = Number(tokens[6]);
      const sr = Number(tokens[7]);
      const ws = Number(tokens[8]);
      const ndvi = Number(tokens[9]);
      const lat = Number(tokens[10]);
      const health = tokens[11].trim();

      if (health in healthDist) {
        healthDist[health]++;
      }

      if (!Number.isNaN(sm)) sumMoisture += sm;
      if (!Number.isNaN(st)) sumSoilTemp += st;
      if (!Number.isNaN(ph)) sumPh += ph;
      if (!Number.isNaN(hum)) sumHum += hum;
      if (!Number.isNaN(at)) sumAirTemp += at;
      if (!Number.isNaN(sr)) sumRad += sr;
      if (!Number.isNaN(ws)) sumWind += ws;
      if (!Number.isNaN(ndvi)) sumNdvi += ndvi;
      if (!Number.isNaN(lat)) sumLatency += lat;

      count++;
    }

    if (count === 0) return null;

    return {
      totalRecords: count,
      dateRange: {
        start: firstTimestamp,
        end: lastTimestamp,
      },
      cropHealthDistribution: {
        Healthy: healthDist.Healthy || 0,
        Moderate_Stress: healthDist.Moderate_Stress || 0,
        High_Stress: healthDist.High_Stress || 0,
      },
      averageLatencyMs: Math.round((sumLatency / count) * 100) / 100,
      fieldAverages: {
        soilMoisture: Math.round((sumMoisture / count) * 100) / 100,
        soilTemperature: Math.round((sumSoilTemp / count) * 100) / 100,
        soilPh: Math.round((sumPh / count) * 100) / 100,
        humidity: Math.round((sumHum / count) * 100) / 100,
        airTemperature: Math.round((sumAirTemp / count) * 100) / 100,
        solarRadiation: Math.round((sumRad / count) * 100) / 100,
        windSpeed: Math.round((sumWind / count) * 100) / 100,
        ndviIndex: Math.round((sumNdvi / count) * 1000) / 1000,
      },
    };
  } catch (err) {
    console.error("Error computing edge sensor summary:", err);
    return null;
  }
}

export class EdgeSensorAdapter implements DatasetAdapter<typeof SOURCE_CONFIG> {
  readonly source = SOURCE_CONFIG;

  async load(query?: AdapterQuery): Promise<AdapterResult<typeof SOURCE_CONFIG>> {
    const provenance = getEdgeSensorProvenance();
    const filePath = resolveSafeRawPath(SOURCE_CONFIG.relativePath);

    if (!fs.existsSync(filePath)) {
      return {
        provenance,
        validation: {
          status: "completed",
          checksPerformed: ["file-existence-check"],
          checksNotPerformed: ["header-schema-validation", "row-parsing"],
          issues: [
            {
              code: "FILE_MISSING",
              severity: "error",
              message: `Edge Sensor CSV not found at expected path: ${SOURCE_CONFIG.relativePath}`,
              references: [{ path: SOURCE_CONFIG.relativePath }],
            },
          ],
        },
        status: "error",
        message: "Source CSV file is missing.",
      };
    }

    const offset = query?.offset ?? 0;
    const limit = Math.min(query?.limit ?? 50, 100);

    try {
      const parseResult = await streamDelimitedFile({
        filePath,
        delimiter: ",",
        offset,
        limit,
      });

      const issues: ValidationIssue[] = [];

      // Check header
      const headerMatches =
        parseResult.header.length === SOURCE_CONFIG.expectedColumns.length &&
        SOURCE_CONFIG.expectedColumns.every((col, i) => parseResult.header[i] === col);

      if (!headerMatches) {
        issues.push({
          code: "HEADER_MISMATCH",
          severity: "error",
          message: `Header mismatch. Expected [${SOURCE_CONFIG.expectedColumns.join(", ")}], found [${parseResult.header.join(", ")}]`,
          references: [{ path: SOURCE_CONFIG.relativePath, recordNumber: 0 }],
        });
      }

      const records: { reference: SourceReference; payload: EdgeSensorRecordPayload }[] = [];

      for (const row of parseResult.rows) {
        const ref: SourceReference = {
          path: sanitizeRepoPath(filePath),
          recordNumber: row.recordNumber,
        };

        const [
          idTok,
          tsTok,
          smTok,
          stTok,
          phTok,
          humTok,
          atTok,
          srTok,
          wsTok,
          ndviTok,
          latTok,
          healthTok,
        ] = row.tokens;

        const payload: EdgeSensorRecordPayload = {
          recordId: parseDatasetNumber(idTok ?? "", "Record_ID"),
          timestamp: parseDatasetString(tsTok ?? "", "Timestamp"),
          soilMoisture: parseDatasetNumber(smTok ?? "", "Soil_Moisture"),
          soilTemperature: parseDatasetNumber(stTok ?? "", "Soil_Temperature"),
          soilPh: parseDatasetNumber(phTok ?? "", "Soil_pH"),
          humidity: parseDatasetNumber(humTok ?? "", "Humidity"),
          airTemperature: parseDatasetNumber(atTok ?? "", "Air_Temperature"),
          solarRadiation: parseDatasetNumber(srTok ?? "", "Solar_Radiation"),
          windSpeed: parseDatasetNumber(wsTok ?? "", "Wind_Speed"),
          ndviIndex: parseDatasetNumber(ndviTok ?? "", "NDVI_Index"),
          latencyMs5G: parseDatasetNumber(latTok ?? "", "5G_Latency_ms"),
          cropHealth: parseDatasetString(healthTok ?? "", "Crop_Health"),
        };

        records.push({ reference: ref, payload });
      }

      const validation: DatasetValidation = {
        status: "completed",
        checksPerformed: [
          "file-existence-check",
          "header-schema-validation",
          "integer-record-id-check",
          "finite-decimal-metrics",
          "hourly-timestamp-string-preserved",
          "crop-health-label-membership",
        ],
        checksNotPerformed: [
          "timezone-inference",
          "disease-diagnosis-verification",
          "image-csv-key-association",
        ],
        issues,
      };

      const rawDataset: RawDataset<typeof SOURCE_CONFIG> = {
        kind: "raw-source",
        provenance,
        records,
      };

      return {
        provenance,
        validation,
        pagination: {
          offset,
          limit,
          totalCount: SOURCE_CONFIG.expectedTotalRecords,
          hasMore: parseResult.hasMore,
        },
        status: "ready",
        data: rawDataset,
      };
    } catch (err) {
      return {
        provenance,
        validation: {
          status: "completed",
          checksPerformed: ["file-existence-check"],
          checksNotPerformed: ["row-parsing"],
          issues: [
            {
              code: "PARSE_EXCEPTION",
              severity: "error",
              message: err instanceof Error ? err.message : String(err),
              references: [{ path: SOURCE_CONFIG.relativePath }],
            },
          ],
        },
        status: "error",
        message: err instanceof Error ? err.message : "Failed to parse Edge Sensor CSV",
      };
    }
  }
}
