import fs from "node:fs";
import { resolveSafeRawPath, sanitizeRepoPath } from "./path-utils";
import { streamDelimitedFile, parseDatasetNumber, parseDatasetString } from "./rfc4180-parser";
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

export const SOIL_STATIONS = [
  "CAF003", "CAF007", "CAF009", "CAF019", "CAF031", "CAF033", "CAF035", "CAF061",
  "CAF067", "CAF075", "CAF079", "CAF095", "CAF119", "CAF125", "CAF129", "CAF133",
  "CAF135", "CAF139", "CAF141", "CAF163", "CAF173", "CAF197", "CAF201", "CAF205",
  "CAF209", "CAF215", "CAF217", "CAF231", "CAF237", "CAF245", "CAF275", "CAF308",
  "CAF310", "CAF312", "CAF314", "CAF316", "CAF349", "CAF351", "CAF357", "CAF377",
  "CAF397", "CAF401",
] as const;

export type SoilStationId = (typeof SOIL_STATIONS)[number];

const SOURCE_CONFIG = {
  datasetId: "field-scale-soil-moisture" as const,
  asset: "tab-delimited-text" as const,
  grain: "Daily" as const,
  expectedColumns: [
    "Location",
    "Date",
    "VW_30cm",
    "VW_60cm",
    "VW_90cm",
    "VW_120cm",
    "VW_150cm",
    "T_30cm",
    "T_60cm",
    "T_90cm",
    "T_120cm",
    "T_150cm",
  ] as const,
  totalStations: 42,
  rowsPerStation: 3346,
  totalDailyRows: 140532,
};

export interface SoilDailyRecordPayload {
  readonly location: DatasetValue<string>;
  readonly date: DatasetValue<string>;
  readonly vw30cm: DatasetValue<number>;
  readonly vw60cm: DatasetValue<number>;
  readonly vw90cm: DatasetValue<number>;
  readonly vw120cm: DatasetValue<number>;
  readonly vw150cm: DatasetValue<number>;
  readonly t30cm: DatasetValue<number>;
  readonly t60cm: DatasetValue<number>;
  readonly t90cm: DatasetValue<number>;
  readonly t120cm: DatasetValue<number>;
  readonly t150cm: DatasetValue<number>;
}

export interface SoilDailyStationSummary {
  readonly station: string;
  readonly totalRows: number;
  readonly dateCoverage: {
    start: string;
    end: string;
  };
  readonly missingCounts: Record<string, number>;
  readonly observedRanges: Record<string, { min: number; max: number; count: number }>;
}

export function getSoilDailyProvenance(station: string = "CAF003"): DatasetProvenance<typeof SOURCE_CONFIG> {
  const fullPath = resolveSafeRawPath("soil-moisture", "Daily", `${station}.txt`);
  const metadata = datasetRegistry.find((d) => d.id === SOURCE_CONFIG.datasetId) as Extract<
    DatasetRegistryEntry,
    { id: "field-scale-soil-moisture" }
  >;

  return {
    source: SOURCE_CONFIG,
    metadata,
    context: "static-dataset",
    inspectionReport: "docs/datasets/README.md",
    sourceVersion: null,
    attribution: "Kaggle: sathyanarayanrao89/soil-moisture-data-from-field-scale-sensor-network",
    licenseReview: {
      status: "not-reviewed",
    },
    limitations: [
      "VW and T measurement definitions and physical units remain undocumented in source headers.",
      "Depth suffixes (30cm to 150cm) state depth in cm, but sampling methodology and probe calibration are unknown.",
      "Literal 'NA' values represent missing sensor readings and must not be coerced to zero or interpolated without validation.",
      "Station identifiers (CAF*) have no geographic latitude/longitude metadata in the raw archive.",
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
 * Computes missingness and summary for a single station's Daily file.
 */
export function getSoilDailyStationSummary(station: string = "CAF003"): SoilDailyStationSummary | null {
  try {
    const filePath = resolveSafeRawPath("soil-moisture", "Daily", `${station}.txt`);
    if (!fs.existsSync(filePath)) return null;

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return null;

    const header = lines[0].split("\t");
    const missingCounts: Record<string, number> = {};
    const ranges: Record<string, { min: number; max: number; count: number }> = {};

    for (let col = 2; col < header.length; col++) {
      const colName = header[col];
      missingCounts[colName] = 0;
      ranges[colName] = { min: Infinity, max: -Infinity, count: 0 };
    }

    let firstDate = "";
    let lastDate = "";
    let rowCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const tokens = lines[i].split("\t");
      if (tokens.length < 12) continue;

      const d = tokens[1].trim();
      if (!firstDate) firstDate = d;
      lastDate = d;
      rowCount++;

      for (let col = 2; col < 12; col++) {
        const colName = header[col];
        const val = tokens[col]?.trim();
        if (!val || val.toUpperCase() === "NA") {
          missingCounts[colName]++;
        } else {
          const num = Number(val);
          if (!Number.isNaN(num)) {
            ranges[colName].min = Math.min(ranges[colName].min, num);
            ranges[colName].max = Math.max(ranges[colName].max, num);
            ranges[colName].count++;
          }
        }
      }
    }

    return {
      station,
      totalRows: rowCount,
      dateCoverage: {
        start: firstDate,
        end: lastDate,
      },
      missingCounts,
      observedRanges: ranges,
    };
  } catch (err) {
    console.error("Error inspecting Daily station summary:", err);
    return null;
  }
}

export class SoilDailyAdapter implements DatasetAdapter<typeof SOURCE_CONFIG> {
  readonly source = SOURCE_CONFIG;

  async load(query?: AdapterQuery): Promise<AdapterResult<typeof SOURCE_CONFIG>> {
    const rawStation = query?.station ?? "CAF003";
    const station = SOIL_STATIONS.includes(rawStation as SoilStationId)
      ? (rawStation as SoilStationId)
      : "CAF003";
    const provenance = getSoilDailyProvenance(station);

    const relativePath = `soil-moisture/Daily/${station}.txt`;
    const filePath = resolveSafeRawPath(relativePath);

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
              message: `Soil Daily station file missing: ${relativePath}`,
              references: [{ path: relativePath }],
            },
          ],
        },
        status: "error",
        message: `Station file ${station}.txt not found.`,
      };
    }

    const offset = query?.offset ?? 0;
    const limit = Math.min(query?.limit ?? 50, 100);

    try {
      const parseResult = await streamDelimitedFile({
        filePath,
        delimiter: "\t",
        offset,
        limit,
      });

      const issues: ValidationIssue[] = [];

      // Validate header
      const headerMatches =
        parseResult.header.length === SOURCE_CONFIG.expectedColumns.length &&
        SOURCE_CONFIG.expectedColumns.every((col, i) => parseResult.header[i] === col);

      if (!headerMatches) {
        issues.push({
          code: "HEADER_MISMATCH",
          severity: "error",
          message: `Header mismatch in Daily/${station}.txt. Expected 12 columns, found [${parseResult.header.join(", ")}]`,
          references: [{ path: relativePath, recordNumber: 0 }],
        });
      }

      const records: { reference: SourceReference; payload: SoilDailyRecordPayload }[] = [];

      for (const row of parseResult.rows) {
        const ref: SourceReference = {
          path: sanitizeRepoPath(filePath),
          recordNumber: row.recordNumber,
        };

        const [
          locTok,
          dateTok,
          vw30Tok,
          vw60Tok,
          vw90Tok,
          vw120Tok,
          vw150Tok,
          t30Tok,
          t60Tok,
          t90Tok,
          t120Tok,
          t150Tok,
        ] = row.tokens;

        const payload: SoilDailyRecordPayload = {
          location: parseDatasetString(locTok ?? "", "Location"),
          date: parseDatasetString(dateTok ?? "", "Date"),
          vw30cm: parseDatasetNumber(vw30Tok ?? "", "VW_30cm"),
          vw60cm: parseDatasetNumber(vw60Tok ?? "", "VW_60cm"),
          vw90cm: parseDatasetNumber(vw90Tok ?? "", "VW_90cm"),
          vw120cm: parseDatasetNumber(vw120Tok ?? "", "VW_120cm"),
          vw150cm: parseDatasetNumber(vw150Tok ?? "", "VW_150cm"),
          t30cm: parseDatasetNumber(t30Tok ?? "", "T_30cm"),
          t60cm: parseDatasetNumber(t60Tok ?? "", "T_60cm"),
          t90cm: parseDatasetNumber(t90Tok ?? "", "T_90cm"),
          t120cm: parseDatasetNumber(t120Tok ?? "", "T_120cm"),
          t150cm: parseDatasetNumber(t150Tok ?? "", "T_150cm"),
        };

        records.push({ reference: ref, payload });
      }

      const validation: DatasetValidation = {
        status: "completed",
        checksPerformed: [
          "file-existence-check",
          "tab-delimiter-validation",
          "schema-header-check",
          "literal-na-preservation",
          "numeric-depth-parsing",
        ],
        checksNotPerformed: [
          "unit-conversion",
          "gap-interpolation",
          "station-geographic-mapping",
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
          totalCount: SOURCE_CONFIG.rowsPerStation,
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
              references: [{ path: relativePath }],
            },
          ],
        },
        status: "error",
        message: err instanceof Error ? err.message : `Failed to parse Soil Daily ${station}.txt`,
      };
    }
  }
}
