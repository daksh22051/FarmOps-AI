import path from "node:path";
import { existsSync } from "node:fs";

/** Base path of the raw datasets relative to process working directory or parent monorepo root */
function getRawDataDir(): string {
  if (process.env.FARM_DATA_DIR && existsSync(process.env.FARM_DATA_DIR)) {
    return path.resolve(process.env.FARM_DATA_DIR);
  }
  const localDataRaw = path.resolve(process.cwd(), "data", "raw");
  if (existsSync(localDataRaw)) {
    return localDataRaw;
  }
  const parentDataRaw = path.resolve(process.cwd(), "..", "data", "raw");
  if (existsSync(parentDataRaw)) {
    return parentDataRaw;
  }
  return localDataRaw;
}

export const RAW_DATA_DIR = getRawDataDir();

/**
 * Validates and resolves a path to ensure it resides strictly within `data/raw`.
 * Throws an Error if traversal is attempted or path is invalid.
 */
export function resolveSafeRawPath(...segments: string[]): string {
  const safeJoined = path.join(...segments.map((s) => s.replace(/\\/g, "/")));
  const resolved = path.resolve(RAW_DATA_DIR, safeJoined);

  // Security check: Must start with RAW_DATA_DIR
  if (!resolved.startsWith(RAW_DATA_DIR)) {
    throw new Error(`Path traversal violation: Access outside data/raw directory is forbidden: ${safeJoined}`);
  }

  return resolved;
}

/**
 * Checks if safe raw path exists on disk.
 */
export function safeRawPathExists(...segments: string[]): boolean {
  try {
    const resolved = resolveSafeRawPath(...segments);
    return existsSync(resolved);
  } catch {
    return false;
  }
}

/**
 * Sanitizes and converts an absolute path back to a repo-relative path for clean provenance
 * without leaking local system paths.
 */
export function sanitizeRepoPath(fullPath: string): string {
  const normalized = fullPath.replace(/\\/g, "/");
  const cwdNormalized = process.cwd().replace(/\\/g, "/");
  if (normalized.startsWith(cwdNormalized)) {
    const relative = normalized.slice(cwdNormalized.length);
    return relative.startsWith("/") ? relative.slice(1) : relative;
  }
  const rawDirNormalized = RAW_DATA_DIR.replace(/\\/g, "/");
  if (normalized.startsWith(rawDirNormalized)) {
    const relative = normalized.slice(rawDirNormalized.length);
    return "data/raw" + (relative.startsWith("/") ? relative : "/" + relative);
  }
  return normalized;
}
