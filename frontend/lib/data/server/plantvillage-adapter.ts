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
  ValidationIssue,
} from "../dataset-adapter";

export type PlantVillageVariant = "color" | "grayscale" | "segmented";

export interface PlantVillageSourceConfig {
  readonly datasetId: "plantvillage";
  readonly asset: "images";
  readonly variant: PlantVillageVariant;
}

const BASE_PATH = "plantvillage/plantvillage dataset";

export interface PlantVillageClassSummary {
  readonly label: string;
  readonly plantName: string;
  readonly conditionLabel: string;
  readonly colorCount: number;
  readonly grayscaleCount: number;
  readonly segmentedCount: number;
}

export interface PlantVillageInventory {
  readonly totalImages: number;
  readonly variantCounts: {
    color: number;
    grayscale: number;
    segmented: number;
  };
  readonly classCount: number;
  readonly classes: readonly PlantVillageClassSummary[];
  readonly anomalies: readonly string[];
}

export function getPlantVillageProvenance(variant: PlantVillageVariant = "color"): DatasetProvenance<PlantVillageSourceConfig> {
  const source: PlantVillageSourceConfig = {
    datasetId: "plantvillage",
    asset: "images",
    variant,
  };

  const fullPath = resolveSafeRawPath(BASE_PATH, variant);
  const metadata = datasetRegistry.find((d) => d.id === "plantvillage") as Extract<
    DatasetRegistryEntry,
    { id: "plantvillage" }
  >;

  return {
    source,
    metadata,
    context: "static-dataset",
    inspectionReport: "docs/datasets/README.md",
    sourceVersion: null,
    attribution: "Kaggle: abdallahalidev/plantvillage-dataset",
    licenseReview: {
      status: "not-reviewed",
    },
    limitations: [
      "Directory names are source-provided categorical labels, not independently certified veterinary/plant-pathology diagnoses.",
      "Segmented Grape___Esca_(Black_Measles) has 1,384 images versus 1,383 in color and grayscale; cross-variant pairing cannot rely on row index.",
      "The dataset contains lab-curated leaf images against uniform backgrounds, which may differ significantly from complex field conditions.",
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
 * Parses a PlantVillage directory name like 'Tomato___Early_blight' into plant and condition.
 */
export function parsePlantVillageLabel(dirName: string): { plant: string; condition: string } {
  const parts = dirName.split("___");
  if (parts.length >= 2) {
    return {
      plant: parts[0].replace(/_/g, " "),
      condition: parts[1].replace(/_/g, " "),
    };
  }
  return { plant: dirName, condition: "Unknown" };
}

/**
 * Computes inventory counts across all 3 variants and 38 classes.
 */
export function getPlantVillageInventory(): PlantVillageInventory | null {
  try {
    const rootPath = resolveSafeRawPath(BASE_PATH);
    if (!fs.existsSync(rootPath)) return null;

    const variants: PlantVillageVariant[] = ["color", "grayscale", "segmented"];
    const variantCounts = { color: 0, grayscale: 0, segmented: 0 };
    const classMap: Record<string, { color: number; grayscale: number; segmented: number }> = {};

    for (const v of variants) {
      const vPath = path.join(rootPath, v);
      if (!fs.existsSync(vPath)) continue;

      const subdirs = fs.readdirSync(vPath, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const subdir of subdirs) {
        if (!classMap[subdir.name]) {
          classMap[subdir.name] = { color: 0, grayscale: 0, segmented: 0 };
        }
        const files = fs.readdirSync(path.join(vPath, subdir.name), { withFileTypes: true });
        const imgCount = files.filter((f) => f.isFile() && /\.(jpe?g|png)$/i.test(f.name)).length;
        classMap[subdir.name][v] = imgCount;
        variantCounts[v] += imgCount;
      }
    }

    const classes: PlantVillageClassSummary[] = Object.entries(classMap)
      .map(([label, counts]) => {
        const { plant, condition } = parsePlantVillageLabel(label);
        return {
          label,
          plantName: plant,
          conditionLabel: condition,
          colorCount: counts.color,
          grayscaleCount: counts.grayscale,
          segmentedCount: counts.segmented,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    const anomalies: string[] = [];
    const esca = classes.find((c) => c.label === "Grape___Esca_(Black_Measles)");
    if (esca && esca.segmentedCount !== esca.colorCount) {
      anomalies.push(
        `Grape___Esca_(Black_Measles) count discrepancy: segmented (${esca.segmentedCount}) vs color (${esca.colorCount})`
      );
    }

    return {
      totalImages: variantCounts.color + variantCounts.grayscale + variantCounts.segmented,
      variantCounts,
      classCount: classes.length,
      classes,
      anomalies,
    };
  } catch (err) {
    console.error("Error inspecting PlantVillage dataset:", err);
    return null;
  }
}

export class PlantVillageAdapter implements DatasetAdapter<PlantVillageSourceConfig> {
  readonly source: PlantVillageSourceConfig;

  constructor(variant: PlantVillageVariant = "color") {
    this.source = {
      datasetId: "plantvillage",
      asset: "images",
      variant,
    };
  }

  async load(query?: AdapterQuery): Promise<AdapterResult<PlantVillageSourceConfig>> {
    const variant = query?.variant ?? this.source.variant;
    const provenance = getPlantVillageProvenance(variant);
    const variantPath = resolveSafeRawPath(BASE_PATH, variant);

    if (!fs.existsSync(variantPath)) {
      return {
        provenance,
        validation: {
          status: "completed",
          checksPerformed: ["directory-existence-check"],
          checksNotPerformed: ["file-enumeration"],
          issues: [
            {
              code: "VARIANT_DIRECTORY_MISSING",
              severity: "error",
              message: `PlantVillage variant directory missing: ${BASE_PATH}/${variant}`,
              references: [{ path: `${BASE_PATH}/${variant}` }],
            },
          ],
        },
        status: "error",
        message: `Variant directory '${variant}' missing.`,
      };
    }

    try {
      const filterLabel = query?.label;
      const offset = query?.offset ?? 0;
      const limit = Math.min(query?.limit ?? 24, 60);

      const subdirs = fs
        .readdirSync(variantPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => !filterLabel || d.name.toLowerCase() === filterLabel.toLowerCase())
        .sort((a, b) => a.name.localeCompare(b.name));

      const specimens: Array<{
        relativePath: string;
        variant: PlantVillageVariant;
        directoryLabel: string;
        plantName: string;
        conditionLabel: string;
        fileName: string;
        byteSize: number;
      }> = [];

      for (const subdir of subdirs) {
        const dirPath = path.join(variantPath, subdir.name);
        const files = fs.readdirSync(dirPath, { withFileTypes: true });
        const imgFiles = files.filter((f) => f.isFile() && /\.(jpe?g|png)$/i.test(f.name));

        const { plant, condition } = parsePlantVillageLabel(subdir.name);

        for (const file of imgFiles) {
          const filePath = path.join(dirPath, file.name);
          const stat = fs.statSync(filePath);
          specimens.push({
            relativePath: `${variant}/${subdir.name}/${file.name}`,
            variant,
            directoryLabel: subdir.name,
            plantName: plant,
            conditionLabel: condition,
            fileName: file.name,
            byteSize: stat.size,
          });
        }
      }

      const paged = specimens.slice(offset, offset + limit);

      const records = paged.map((specimen, idx) => ({
        reference: {
          path: sanitizeRepoPath(path.join(variantPath, specimen.directoryLabel, specimen.fileName)),
          recordNumber: offset + idx + 1,
        },
        payload: specimen,
      }));

      const issues: ValidationIssue[] = [];
      if (variant === "segmented" && (!filterLabel || filterLabel === "Grape___Esca_(Black_Measles)")) {
        issues.push({
          code: "KNOWN_COUNT_ANOMALY",
          severity: "info",
          message: "Grape___Esca_(Black_Measles) contains 1,384 segmented files vs 1,383 in color/grayscale.",
          references: [{ path: `${BASE_PATH}/segmented/Grape___Esca_(Black_Measles)` }],
        });
      }

      const validation: DatasetValidation = {
        status: "completed",
        checksPerformed: [
          "variant-directory-existence",
          "directory-label-enumeration",
          "image-extension-validation",
        ],
        checksNotPerformed: [
          "full-archive-decoding",
          "pixel-integrity-checks",
          "ai-disease-classification",
        ],
        issues,
      };

      const rawDataset: RawDataset<PlantVillageSourceConfig> = {
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
          totalCount: specimens.length,
          hasMore: offset + limit < specimens.length,
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
              code: "PARSE_ERROR",
              severity: "error",
              message: err instanceof Error ? err.message : String(err),
              references: [{ path: `${BASE_PATH}/${variant}` }],
            },
          ],
        },
        status: "error",
        message: err instanceof Error ? err.message : "Failed to inventory PlantVillage variant",
      };
    }
  }
}
