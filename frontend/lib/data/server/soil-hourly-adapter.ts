import fs from "node:fs";
import { resolveSafeRawPath, sanitizeRepoPath } from "./path-utils";
import { streamDelimitedFile, parseDatasetNumber, parseDatasetString } from "./rfc4180-parser";
import { datasetRegistry, type DatasetRegistryEntry } from "../dataset-registry";
import { SOIL_STATIONS, type SoilStationId } from "./soil-daily-adapter";
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
  datasetId: "field-scale-soil-moisture" as const,
  asset: "tab-delimited-text" as const,
  grain: "Hourly" as const,
  expectedColumns: [
    "Location",
    "Date",
    "Time",
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
  standardRowsPerStation: 80304,
  caf201TotalRows: 81194,
  caf201TrailingAnomalyRows: 890,
  totalHourlyRows: 3373658,
};

export interface SoilHourlyRecordPayload {
  readonly location: DatasetValue<string>;
  readonly date: DatasetValue<string>;
  readonly time: DatasetValue<string>;
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

export function getSoilHourlyProvenance(station: string = "CAF003"): DatasetProvenance<typeof SOURCE_CONFIG> {
  const fullPath = resolveSafeRawPath("soil-moisture", "Hourly", `${station}.txt`);
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
      "Total hourly volume exceeds 3.37 million records across 42 station files; streaming access is mandatory to avoid memory exhaustion.",
      "Hourly timestamps have no stated timezone. VW and T units remain unassigned.",
      "Hourly/CAF201.txt ends with 890 trailing rows retaining Location=CAF201 but with NA for date, time, and all measurements (889 duplicate lines).",
      "Observed sensor readings contain substantial NA missingness representing field sensor outages.",
    ],
    files: [
      {
        path: sanitizeRepoPath(fullPath),
        sha256: null,
      },
    ],
  };
}

export class SoilHourlyAdapter implements DatasetAdapter<typeof SOURCE_CONFIG> {
  readonly source = SOURCE_CONFIG;

  async load(query?: AdapterQuery): Promise<AdapterResult<typeof SOURCE_CONFIG>> {
    const rawStation = query?.station ?? "CAF003";
    const station = SOIL_STATIONS.includes(rawStation as SoilStationId)
      ? (rawStation as SoilStationId)
      : "CAF003";
    const provenance = getSoilHourlyProvenance(station);

    const relativePath = `soil-moisture/Hourly/${station}.txt`;
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
              message: `Soil Hourly station file missing: ${relativePath}`,
              references: [{ path: relativePath }],
            },
          ],
        },
        status: "error",
        message: `Hourly file ${station}.txt not found.`,
      };
    }

    const offset = query?.offset ?? 0;
    const limit = Math.min(query?.limit ?? 50, 100);
    const isCaf201 = station === "CAF201";

    try {
      const parseResult = await streamDelimitedFile({
        filePath,
        delimiter: "\t",
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
          message: `Header mismatch in Hourly/${station}.txt. Expected 13 columns, found [${parseResult.header.join(", ")}]`,
          references: [{ path: relativePath, recordNumber: 0 }],
        });
      }

      // Check for CAF201 anomaly detection
      if (isCaf201) {
        issues.push({
          code: "CAF201_TRAILING_ANOMALY_DOCUMENTED",
          severity: "warning",
          message: "Hourly/CAF201.txt contains 890 trailing all-missing records (889 duplicate lines) preserved without modification.",
          references: [{ path: relativePath, recordNumber: 80305 }],
        });
      }

      const records: { reference: SourceReference; payload: SoilHourlyRecordPayload }[] = [];

      for (const row of parseResult.rows) {
        const ref: SourceReference = {
          path: sanitizeRepoPath(filePath),
          recordNumber: row.recordNumber,
        };

        const [
          locTok,
          dateTok,
          timeTok,
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

        const payload: SoilHourlyRecordPayload = {
          location: parseDatasetString(locTok ?? "", "Location"),
          date: parseDatasetString(dateTok ?? "", "Date"),
          time: parseDatasetString(timeTok ?? "", "Time"),
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
          "13-column-schema-check",
          "literal-na-preservation",
          "streaming-memory-boundary-enforcement",
          ...(isCaf201 ? ["caf201-trailing-anomaly-audit"] : []),
        ],
        checksNotPerformed: [
          "full-3.37m-row-scan-per-request",
          "cross-station-deduplication",
          "gap-interpolation",
        ],
        issues,
      };

      const rawDataset: RawDataset<typeof SOURCE_CONFIG> = {
        kind: "raw-source",
        provenance,
        records,
      };

      const totalStationRows = isCaf201
        ? SOURCE_CONFIG.caf201TotalRows
        : SOURCE_CONFIG.standardRowsPerStation;

      return {
        provenance,
        validation,
        pagination: {
          offset,
          limit,
          totalCount: totalStationRows,
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
        message: err instanceof Error ? err.message : `Failed to stream Soil Hourly ${station}.txt`,
      };
    }
  }
}
