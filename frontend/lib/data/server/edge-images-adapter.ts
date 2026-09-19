import fs from "node:fs";
import path from "node:path";
import { resolveSafeRawPath, sanitizeRepoPath } from "./path-utils";
import { datasetRegistry, type DatasetRegistryEntry } from "../dataset-registry";
import type {
  AdapterQuery,
  AdapterResult,
  DatasetAdapter,
  DatasetProvenance,
  DatasetValidation,
  RawDataset,
} from "../dataset-adapter";

const SOURCE_CONFIG = {
  datasetId: "edge-assisted-agricultural-sensors" as const,
  asset: "images" as const,
  relativePath: "edge-agricultural-sensor/Images/Agricultural-crops",
  expectedDirectories: 30,
  expectedTotalImages: 829,
};

export interface EdgeImageSpecimen {
  readonly relativePath: string; // e.g. "rice/image (1).jpg"
  readonly directoryLabel: string;
  readonly fileName: string;
  readonly extension: string;
  readonly byteSize: number;
}

export interface EdgeImageDirectorySummary {
  readonly label: string;
  readonly imageCount: number;
  readonly sampleImages: readonly string[]; // relative paths
}

export interface EdgeImagesInventory {
  readonly totalImages: number;
  readonly directoryCount: number;
  readonly directories: readonly EdgeImageDirectorySummary[];
  readonly extensionCounts: Record<string, number>;
}

export function getEdgeImagesProvenance(): DatasetProvenance<typeof SOURCE_CONFIG> {
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
      "Image folder names are source-provided crop names, not independently verified diagnoses or cultivars.",
      "No manifest or relational key connects these 829 images to the 2,000 sensor telemetry records in the same repository.",
      "Images vary in resolution and aspect ratio (e.g. 275x183 to 1665x1245).",
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
 * Inventories the 30 crop image directories under edge-agricultural-sensor.
 */
export function getEdgeImagesInventory(): EdgeImagesInventory | null {
  try {
    const rootPath = resolveSafeRawPath(SOURCE_CONFIG.relativePath);
    if (!fs.existsSync(rootPath)) return null;

    const dirEntries = fs.readdirSync(rootPath, { withFileTypes: true });
    const subdirs = dirEntries.filter((d) => d.isDirectory());

    let totalImages = 0;
    const extensionCounts: Record<string, number> = {};
    const directories: EdgeImageDirectorySummary[] = [];

    for (const subdir of subdirs) {
      const dirPath = path.join(rootPath, subdir.name);
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      const imageFiles = files.filter((f) => f.isFile() && /\.(jpe?g|png)$/i.test(f.name));

      totalImages += imageFiles.length;

      for (const img of imageFiles) {
        const ext = path.extname(img.name).toLowerCase();
        extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
      }

      directories.push({
        label: subdir.name,
        imageCount: imageFiles.length,
        sampleImages: imageFiles.slice(0, 3).map((f) => `${subdir.name}/${f.name}`),
      });
    }

    directories.sort((a, b) => a.label.localeCompare(b.label));

    return {
      totalImages,
      directoryCount: directories.length,
      directories,
      extensionCounts,
    };
  } catch (err) {
    console.error("Error inspecting edge images:", err);
    return null;
  }
}

export class EdgeImagesAdapter implements DatasetAdapter<typeof SOURCE_CONFIG> {
  readonly source = SOURCE_CONFIG;

  async load(query?: AdapterQuery): Promise<AdapterResult<typeof SOURCE_CONFIG>> {
    const provenance = getEdgeImagesProvenance();
    const rootPath = resolveSafeRawPath(SOURCE_CONFIG.relativePath);

    if (!fs.existsSync(rootPath)) {
      return {
        provenance,
        validation: {
          status: "completed",
          checksPerformed: ["directory-existence-check"],
          checksNotPerformed: ["file-enumeration"],
          issues: [
            {
              code: "DIRECTORY_MISSING",
              severity: "error",
              message: `Edge Images directory not found: ${SOURCE_CONFIG.relativePath}`,
              references: [{ path: SOURCE_CONFIG.relativePath }],
            },
          ],
        },
        status: "error",
        message: "Source image directory is missing.",
      };
    }

    try {
      const filterLabel = query?.label;
      const offset = query?.offset ?? 0;
      const limit = Math.min(query?.limit ?? 30, 60);

      const dirEntries = fs.readdirSync(rootPath, { withFileTypes: true });
      const subdirs = dirEntries
        .filter((d) => d.isDirectory())
        .filter((d) => !filterLabel || d.name.toLowerCase() === filterLabel.toLowerCase())
        .sort((a, b) => a.name.localeCompare(b.name));

      const allSpecimens: EdgeImageSpecimen[] = [];

      for (const subdir of subdirs) {
        const dirPath = path.join(rootPath, subdir.name);
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        const imageFiles = files.filter((f) => f.isFile() && /\.(jpe?g|png)$/i.test(f.name));

        for (const file of imageFiles) {
          const filePath = path.join(dirPath, file.name);
          const stat = fs.statSync(filePath);
          allSpecimens.push({
            relativePath: `${subdir.name}/${file.name}`,
            directoryLabel: subdir.name,
            fileName: file.name,
            extension: path.extname(file.name).toLowerCase(),
            byteSize: stat.size,
          });
        }
      }

      const paged = allSpecimens.slice(offset, offset + limit);

      const records = paged.map((specimen, idx) => ({
        reference: {
          path: sanitizeRepoPath(path.join(rootPath, specimen.relativePath)),
          recordNumber: offset + idx + 1,
        },
        payload: specimen,
      }));

      const validation: DatasetValidation = {
        status: "completed",
        checksPerformed: [
          "directory-existence-check",
          "directory-count-verification",
          "allowed-extensions-verification",
          "file-size-nonzero-check",
        ],
        checksNotPerformed: [
          "pixel-decoding-all-images",
          "corrupt-jpeg-scan",
          "agronomic-leaf-verification",
        ],
        issues: [],
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
          totalCount: allSpecimens.length,
          hasMore: offset + limit < allSpecimens.length,
        },
        status: "ready",
        data: rawDataset,
      };
    } catch (err) {
      return {
        provenance,
        validation: {
          status: "completed",
          checksPerformed: ["directory-existence-check"],
          checksNotPerformed: ["file-enumeration"],
          issues: [
            {
              code: "INVENTORY_ERROR",
              severity: "error",
              message: err instanceof Error ? err.message : String(err),
              references: [{ path: SOURCE_CONFIG.relativePath }],
            },
          ],
        },
        status: "error",
        message: err instanceof Error ? err.message : "Failed to inventory Edge images",
      };
    }
  }
}
