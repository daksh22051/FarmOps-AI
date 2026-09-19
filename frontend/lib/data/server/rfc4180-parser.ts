import fs from "node:fs";
import readline from "node:readline";
import type { DatasetValue } from "../dataset-adapter";

export interface ParsedRow {
  readonly recordNumber: number; // 1-based index (excluding header)
  readonly tokens: readonly string[];
  readonly rawLine: string;
}

export interface StreamParseOptions {
  readonly filePath: string;
  readonly delimiter?: string; // default ','
  readonly offset?: number;
  readonly limit?: number;
  readonly maxLinesToScan?: number;
}

export interface StreamParseResult {
  readonly header: readonly string[];
  readonly rows: readonly ParsedRow[];
  readonly totalLinesScanned: number;
  readonly hasMore: boolean;
}

/**
 * Splits a single RFC 4180 delimited line into field tokens.
 * Correctly respects quoted fields, escaped quotes (""), and custom delimiters.
 */
export function parseDelimitedLine(line: string, delimiter: string = ","): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        fields.push(currentField);
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        // Skip CR
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  fields.push(currentField);
  return fields;
}

/**
 * Streams a delimited file and yields a bounded page of parsed records without buffering the whole file.
 */
export async function streamDelimitedFile(options: StreamParseOptions): Promise<StreamParseResult> {
  const { filePath, delimiter = ",", offset = 0, limit = 50, maxLinesToScan } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let header: string[] | null = null;
  const rows: ParsedRow[] = [];
  let recordIndex = 0;
  let totalLinesScanned = 0;
  let hasMore = false;

  for await (const rawLine of rl) {
    totalLinesScanned++;

    // Stop if safety scan limit hit
    if (maxLinesToScan && totalLinesScanned > maxLinesToScan) {
      hasMore = true;
      break;
    }

    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue; // Skip blank lines
    }

    if (!header) {
      header = parseDelimitedLine(rawLine, delimiter);
      continue;
    }

    recordIndex++;

    // Handle offset
    if (recordIndex <= offset) {
      continue;
    }

    // Check limit
    if (rows.length < limit) {
      const tokens = parseDelimitedLine(rawLine, delimiter);
      rows.push({
        recordNumber: recordIndex,
        tokens,
        rawLine,
      });
    } else {
      hasMore = true;
      break; // Reached limit + 1, we know there are more records
    }
  }

  rl.close();
  fileStream.destroy();

  return {
    header: header ?? [],
    rows,
    totalLinesScanned,
    hasMore,
  };
}

/**
 * Converts a raw string token into a typed DatasetValue<number> without coercing NA or empty to zero.
 */
export function parseDatasetNumber(token: string, fieldName: string): DatasetValue<number> {
  const trimmed = token.trim();

  if (trimmed === "" || trimmed.toUpperCase() === "NA" || trimmed.toUpperCase() === "NULL") {
    return {
      status: "missing",
      value: null,
      rawToken: token,
      reason: `Missing token '${token}' for field '${fieldName}'`,
    };
  }

  const num = Number(trimmed);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return {
      status: "invalid",
      value: null,
      rawToken: token,
      reason: `Non-finite or malformed number '${token}' for field '${fieldName}'`,
    };
  }

  return {
    status: "present",
    value: num,
    rawToken: token,
  };
}

/**
 * Converts a raw string token into a typed DatasetValue<string>.
 */
export function parseDatasetString(token: string, fieldName: string): DatasetValue<string> {
  const trimmed = token.trim();

  if (trimmed === "" || trimmed.toUpperCase() === "NA" || trimmed.toUpperCase() === "NULL") {
    return {
      status: "missing",
      value: null,
      rawToken: token,
      reason: `Empty or NA string for field '${fieldName}'`,
    };
  }

  return {
    status: "present",
    value: token,
    rawToken: token,
  };
}
