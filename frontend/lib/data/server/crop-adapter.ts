import fs from "node:fs";
import { resolveSafeRawPath, sanitizeRepoPath } from "./path-utils";
import { parseDelimitedLine, streamDelimitedFile, parseDatasetNumber, parseDatasetString } from "./rfc4180-parser";
import { datasetRegistry, type DatasetRegistryEntry } from "../dataset-registry";
import type {
  AdapterQuery,
  AdapterResult,
  DatasetAdapter,
  DatasetProvenance,
  DatasetSource,
  DatasetValidation,
  DatasetValue,
  RawDataset,
  SourceReference,
  ValidationIssue,
} from "../dataset-adapter";

export type CropSource = Extract<DatasetSource, { datasetId: "crop-recommendation" }>;

const SOURCE_CONFIG: CropSource = {
  datasetId: "crop-recommendation",
  asset: "csv",
};

const CROP_FILE_CONFIG = {
  relativePath: "crop-recommendation/Crop_recommendation.csv",
  expectedColumns: ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "label"] as const,
  expectedTotalRecords: 2200,
  expectedClasses: 22,
  recordsPerClass: 100,
};

export interface CropRecordPayload {
  readonly N: DatasetValue<number>;
  readonly P: DatasetValue<number>;
  readonly K: DatasetValue<number>;
  readonly temperature: DatasetValue<number>;
  readonly humidity: DatasetValue<number>;
  readonly ph: DatasetValue<number>;
  readonly rainfall: DatasetValue<number>;
  readonly label: DatasetValue<string>;
}

export interface CropDatasetSummary {
  readonly totalRecords: number;
  readonly classDistribution: Record<string, number>;
  readonly fieldRanges: {
    readonly [K in "N" | "P" | "K" | "temperature" | "humidity" | "ph" | "rainfall"]: {
      min: number;
      max: number;
      mean: number;
    };
  };
}

export function getCropProvenance(): DatasetProvenance<typeof SOURCE_CONFIG> {
  const fullPath = resolveSafeRawPath(CROP_FILE_CONFIG.relativePath);
  const metadata = datasetRegistry.find((d) => d.id === SOURCE_CONFIG.datasetId) as Extract<
    DatasetRegistryEntry,
    { id: "crop-recommendation" }
  >;

  return {
    source: SOURCE_CONFIG,
    metadata,
    context: "static-dataset",
    inspectionReport: "docs/datasets/README.md",
    sourceVersion: null,
    attribution: "Kaggle: atharvaingle/crop-recommendation-dataset",
    licenseReview: {
      status: "not-reviewed",
    },
    limitations: [
      "Measurement units for N, P, K, temperature, humidity, and rainfall are not documented in source headers.",
      "Balanced label counts (100 each for 22 crops) indicate potential synthetic or curated distribution.",
      "Static dataset records must not be presented as live farm readings or personalized recommendations.",
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
 * Computes descriptive statistics for the 2,200 Crop Recommendation records.
 */
export function getCropDatasetSummary(): CropDatasetSummary | null {
  try {
    const fullPath = resolveSafeRawPath(CROP_FILE_CONFIG.relativePath);
    if (!fs.existsSync(fullPath)) return null;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return null;

    const classDistribution: Record<string, number> = {};

    const stats = {
      N: { min: Infinity, max: -Infinity, sum: 0 },
      P: { min: Infinity, max: -Infinity, sum: 0 },
      K: { min: Infinity, max: -Infinity, sum: 0 },
      temperature: { min: Infinity, max: -Infinity, sum: 0 },
      humidity: { min: Infinity, max: -Infinity, sum: 0 },
      ph: { min: Infinity, max: -Infinity, sum: 0 },
      rainfall: { min: Infinity, max: -Infinity, sum: 0 },
    };

    let validCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const tokens = parseDelimitedLine(lines[i], ",");
      if (tokens.length < 8) continue;

      const n = Number(tokens[0]);
      const p = Number(tokens[1]);
      const k = Number(tokens[2]);
      const temp = Number(tokens[3]);
      const hum = Number(tokens[4]);
      const ph = Number(tokens[5]);
      const rain = Number(tokens[6]);
      const label = tokens[7].trim();

      classDistribution[label] = (classDistribution[label] || 0) + 1;

      if (!Number.isNaN(n)) { stats.N.min = Math.min(stats.N.min, n); stats.N.max = Math.max(stats.N.max, n); stats.N.sum += n; }
      if (!Number.isNaN(p)) { stats.P.min = Math.min(stats.P.min, p); stats.P.max = Math.max(stats.P.max, p); stats.P.sum += p; }
      if (!Number.isNaN(k)) { stats.K.min = Math.min(stats.K.min, k); stats.K.max = Math.max(stats.K.max, k); stats.K.sum += k; }
      if (!Number.isNaN(temp)) { stats.temperature.min = Math.min(stats.temperature.min, temp); stats.temperature.max = Math.max(stats.temperature.max, temp); stats.temperature.sum += temp; }
      if (!Number.isNaN(hum)) { stats.humidity.min = Math.min(stats.humidity.min, hum); stats.humidity.max = Math.max(stats.humidity.max, hum); stats.humidity.sum += hum; }
      if (!Number.isNaN(ph)) { stats.ph.min = Math.min(stats.ph.min, ph); stats.ph.max = Math.max(stats.ph.max, ph); stats.ph.sum += ph; }
      if (!Number.isNaN(rain)) { stats.rainfall.min = Math.min(stats.rainfall.min, rain); stats.rainfall.max = Math.max(stats.rainfall.max, rain); stats.rainfall.sum += rain; }

      validCount++;
    }

    return {
      totalRecords: validCount,
      classDistribution,
      fieldRanges: {
        N: { min: stats.N.min, max: stats.N.max, mean: Math.round((stats.N.sum / validCount) * 100) / 100 },
        P: { min: stats.P.min, max: stats.P.max, mean: Math.round((stats.P.sum / validCount) * 100) / 100 },
        K: { min: stats.K.min, max: stats.K.max, mean: Math.round((stats.K.sum / validCount) * 100) / 100 },
        temperature: { min: Math.round(stats.temperature.min * 100) / 100, max: Math.round(stats.temperature.max * 100) / 100, mean: Math.round((stats.temperature.sum / validCount) * 100) / 100 },
        humidity: { min: Math.round(stats.humidity.min * 100) / 100, max: Math.round(stats.humidity.max * 100) / 100, mean: Math.round((stats.humidity.sum / validCount) * 100) / 100 },
        ph: { min: Math.round(stats.ph.min * 100) / 100, max: Math.round(stats.ph.max * 100) / 100, mean: Math.round((stats.ph.sum / validCount) * 100) / 100 },
        rainfall: { min: Math.round(stats.rainfall.min * 100) / 100, max: Math.round(stats.rainfall.max * 100) / 100, mean: Math.round((stats.rainfall.sum / validCount) * 100) / 100 },
      },
    };
  } catch (err) {
    console.error("Error computing crop dataset summary:", err);
    return null;
  }
}

export class CropRecommendationAdapter implements DatasetAdapter<typeof SOURCE_CONFIG> {
  readonly source = SOURCE_CONFIG;

  async load(query?: AdapterQuery): Promise<AdapterResult<typeof SOURCE_CONFIG>> {
    const provenance = getCropProvenance();
    const filePath = resolveSafeRawPath(CROP_FILE_CONFIG.relativePath);

    if (!fs.existsSync(filePath)) {
      return {
        provenance,
        validation: {
          status: "completed",
          checksPerformed: ["file-existence-check"],
          checksNotPerformed: ["header-schema-validation", "row-parsing", "type-checks"],
          issues: [
            {
              code: "FILE_MISSING",
              severity: "error",
              message: `Crop Recommendation CSV not found at expected path: ${CROP_FILE_CONFIG.relativePath}`,
              references: [{ path: CROP_FILE_CONFIG.relativePath }],
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

      // Validate header
      const headerMatches =
        parseResult.header.length === CROP_FILE_CONFIG.expectedColumns.length &&
        CROP_FILE_CONFIG.expectedColumns.every((col, i) => parseResult.header[i] === col);

      if (!headerMatches) {
        issues.push({
          code: "HEADER_MISMATCH",
          severity: "error",
          message: `Header does not match expected schema. Found: [${parseResult.header.join(", ")}], Expected: [${CROP_FILE_CONFIG.expectedColumns.join(", ")}]`,
          references: [{ path: CROP_FILE_CONFIG.relativePath, recordNumber: 0 }],
        });
      }

      const records: { reference: SourceReference; payload: CropRecordPayload }[] = [];

      for (const row of parseResult.rows) {
        const ref: SourceReference = {
          path: sanitizeRepoPath(filePath),
          recordNumber: row.recordNumber,
        };

        const [nTok, pTok, kTok, tempTok, humTok, phTok, rainTok, labelTok] = row.tokens;

        const payload: CropRecordPayload = {
          N: parseDatasetNumber(nTok ?? "", "N"),
          P: parseDatasetNumber(pTok ?? "", "P"),
          K: parseDatasetNumber(kTok ?? "", "K"),
          temperature: parseDatasetNumber(tempTok ?? "", "temperature"),
          humidity: parseDatasetNumber(humTok ?? "", "humidity"),
          ph: parseDatasetNumber(phTok ?? "", "ph"),
          rainfall: parseDatasetNumber(rainTok ?? "", "rainfall"),
          label: parseDatasetString(labelTok ?? "", "label"),
        };

        records.push({ reference: ref, payload });
      }

      const validation: DatasetValidation = {
        status: "completed",
        checksPerformed: [
          "file-existence-check",
          "header-schema-validation",
          "row-width-validation",
          "finite-decimal-parsing",
          "integer-npk-parsing",
          "non-empty-label-check",
        ],
        checksNotPerformed: [
          "agronomic-physical-validity",
          "geographic-origin-check",
          "ml-predictive-accuracy",
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
          totalCount: CROP_FILE_CONFIG.expectedTotalRecords,
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
              references: [{ path: CROP_FILE_CONFIG.relativePath }],
            },
          ],
        },
        status: "error",
        message: err instanceof Error ? err.message : "Failed to parse Crop Recommendation CSV",
      };
    }
  }
}
