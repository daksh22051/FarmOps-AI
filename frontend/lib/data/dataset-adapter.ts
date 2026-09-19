import type { datasetRegistry } from "./dataset-registry";

/** Reuse registry identities and metadata rather than maintaining another registry. */
export type DatasetMetadata = (typeof datasetRegistry)[number];
export type DatasetId = DatasetMetadata["id"];

/** Asset boundaries only; no inferred row schemas, image joins, or diagnoses. */
export type DatasetSource =
  | { readonly datasetId: "crop-recommendation"; readonly asset: "csv" }
  | { readonly datasetId: "edge-assisted-agricultural-sensors"; readonly asset: "csv" | "images" }
  | { readonly datasetId: "plantvillage"; readonly asset: "images"; readonly variant: "color" | "grayscale" | "segmented" }
  | { readonly datasetId: "field-scale-soil-moisture"; readonly asset: "tab-delimited-text"; readonly grain: "Daily" | "Hourly" };

export interface SourceReference {
  /** Exact original file path; never a derived output path. */
  readonly path: string;
  /** One-based data record number, excluding the header; absent for file/image issues. */
  readonly recordNumber?: number;
  readonly field?: string;
}

export interface DatasetProvenance<S extends DatasetSource> {
  readonly source: S;
  readonly metadata: Extract<DatasetMetadata, { readonly id: S["datasetId"] }>;
  readonly context: "static-dataset";
  readonly inspectionReport: "docs/datasets/README.md";
  /** Null means unknown, not an inferred version or attribution. */
  readonly sourceVersion: string | null;
  readonly attribution: string | null;
  readonly licenseReview:
    | { readonly status: "not-reviewed" }
    | { readonly status: "reviewed"; readonly evidence: string; readonly restrictions: readonly string[] };
  readonly limitations: readonly string[];
  readonly files: readonly {
    readonly path: string;
    /** Null until a checksum has actually been computed. */
    readonly sha256: string | null;
  }[];
}

/** Future parsers must retain tokens and never coerce missing/invalid values to zero. */
export type DatasetValue<T> =
  | { readonly status: "present"; readonly value: T; readonly rawToken: string }
  | { readonly status: "missing"; readonly value: null; readonly rawToken: string | null; readonly reason: string }
  | { readonly status: "invalid"; readonly value: null; readonly rawToken: string; readonly reason: string };

export interface ValidationIssue {
  readonly code: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  /** Multiple references allow reporting duplicate groups without removing them. */
  readonly references: readonly SourceReference[];
}

/** A completed check is not proof of agronomic validity or complete source verification. */
export type DatasetValidation =
  | { readonly status: "not-run" }
  | {
      readonly status: "completed";
      readonly checksPerformed: readonly string[];
      readonly checksNotPerformed: readonly string[];
      readonly issues: readonly ValidationIssue[];
    };

/** Untyped source payloads cannot be consumed as dashboard measurements without narrowing. */
export interface RawDataset<S extends DatasetSource> {
  readonly kind: "raw-source";
  readonly provenance: DatasetProvenance<S>;
  readonly records: readonly {
    readonly reference: SourceReference;
    readonly payload: unknown;
  }[];
}

export interface AdapterQuery {
  readonly offset?: number;
  readonly limit?: number;
  readonly station?: string;
  readonly variant?: "color" | "grayscale" | "segmented";
  readonly label?: string;
  readonly search?: string;
}

export interface PaginationMetadata {
  readonly offset: number;
  readonly limit: number;
  readonly totalCount?: number;
  readonly hasMore: boolean;
}

export type AdapterResult<S extends DatasetSource> = {
  readonly provenance: DatasetProvenance<S>;
  readonly validation: DatasetValidation;
  readonly pagination?: PaginationMetadata;
} & (
  | { readonly status: "ready"; readonly data: RawDataset<S> }
  | { readonly status: "empty"; readonly reason: string }
  | { readonly status: "error"; readonly message: string }
);

/** Loading is independent of registry intake/integration/cleaning status. */
export type DatasetLoadState<S extends DatasetSource> =
  | { readonly status: "idle"; readonly source: S }
  | { readonly status: "loading"; readonly source: S }
  | AdapterResult<S>;

/** Future read-only loaders: no writes, cleanup, exclusions, or dashboard mapping here. */
export interface DatasetAdapter<S extends DatasetSource> {
  readonly source: S;
  readonly load: (query?: AdapterQuery) => Promise<AdapterResult<S>>;
}

export interface ExcludedRecord {
  readonly reference: SourceReference;
  readonly reason: string;
  readonly ruleId: string;
  readonly supportingEvidence: string;
  readonly approvalReference: string;
}

/** An execution record is distinct from the currently proposed, unexecuted policies. */
export type ProcessingAudit =
  | { readonly status: "not-executed"; readonly cleaningStatus: "proposed-not-executed" }
  | {
      readonly status: "executed";
      readonly processingVersion: string;
      readonly executedAt: string;
      readonly approvalReference: string;
      readonly appliedRuleIds: readonly string[];
      readonly excludedRecords: readonly ExcludedRecord[];
      /** Future implementations must reconcile input = retained + excluded records. */
      readonly inputRecordCount: number;
      readonly retainedRecordCount: number;
    };

/**
 * Separate future consumer-facing boundary, not a dashboard model or a transformation.
 * Define T only after the use case is approved; carry DatasetValue for nullable fields.
 * Preserve source labels verbatim and variant/grain identity through provenance.
 * Raw immutability and audit reconciliation require runtime checks in future implementations;
 * TypeScript readonly does not freeze payloads or protect files on disk.
 */
export interface DerivedDataset<S extends DatasetSource, T = unknown> {
  readonly kind: "derived-data";
  readonly displayContext: "dataset-derived-demonstration";
  readonly provenance: DatasetProvenance<S>;
  readonly validation: DatasetValidation;
  readonly processing: Extract<ProcessingAudit, { readonly status: "executed" }>;
  /** Derived values must retain contributing source references, including for aggregates. */
  readonly records: readonly {
    readonly sources: readonly SourceReference[];
    readonly value: Readonly<T>;
  }[];
}
