# Dataset adapter implementation plan

**Status: proposed, not implemented.** No loader, cleaning rule, derived dataset, API, or UI integration is authorized or executed by this document.

## Evidence and scope

Read alongside [the inspection report and proposed policies](README.md), `lib/data/dataset-registry.ts`, and `lib/data/dataset-adapter.ts`. The report is the source of truth for full inventories, counts, labels, missingness, and duplicate findings. This planning review rechecked both CSV headers and sizes, sample Daily/Hourly headers and records, station filenames, and image-root directory names. It did not repeat full row counts, image decoding, hashing, or duplicate analysis.

The registry retains four source identities. Six loaders are proposed because Edge CSV/images and soil Daily/Hourly require separate handling. Source URLs remain authoritative in the registry/report. Local license documents were not found in the inspection; source terms remain unreviewed. Downloaded and structurally inspected does not mean integrated, cleaned, or scientifically validated.

## Proposed architecture and ownership

1. Keep originals under `data/raw/`, outside `public/`. Current ignore rules already cover `data/raw/`, `data/processed/`, `data/generated/`, `data/cache/`, and `public/datasets/`. Git ignore is not access control or a deployment exclusion guarantee.
2. Proposed Node-only implementation location: `lib/data/server/`, with six descriptive loader modules: `crop-recommendation.ts`, `edge-sensor-csv.ts`, `edge-images.ts`, `plantvillage-images.ts`, `soil-daily.ts`, and `soil-hourly.ts`. These files do not exist as part of this plan. Share only delimiter parsing, safe path resolution, and issue reporting where genuinely common.
3. Keep the existing type-only contracts portable. Future filesystem modules must use a server-only import boundary, never be imported from Client Components or a shared client barrel, and run in Node rather than the Edge runtime. A filename containing `server` alone does not enforce this. Next supports server-side data access and passing selected results to clients; use the smallest serializable payload. See [Next server-side fetching guidance](https://nextjs.org/learn/dashboard-app/fetching-data).
4. Initially, authorize local read-only loader tests outside page rendering. Later, a Server Component may call an approved bounded reader without creating an API. Do not scan the archive during a production build or every render. A browser-only deployment cannot read this project's filesystem; it would need an explicitly approved small, licensed static export or a Member 1 service.
5. Member 2 can own contracts, read-only local loaders, validation presentation, and bounded demonstration UI after approval. Member 1 must coordinate hosted dataset storage, authenticated endpoints/image delivery, shared caches/indexes, scheduled ingestion, and production-scale scans. These require a separate backend phase. No database or API is proposed for immediate implementation.
6. Any future derived output belongs in a separate approved location such as `data/processed/`, never overwrites raw input, and must carry processing/audit metadata. The initial loader milestone returns source records and validation only, not cleansed or aggregated measurements.

### Contract decisions before implementation

- Reuse `DatasetSource`, registry-derived IDs, `DatasetValue`, `SourceReference`, provenance, and validation types. Specialize each adapter's source to one asset/grain; do not use an ambiguous Edge `csv | images` instance.
- `DatasetAdapter.load()` currently accepts no query and `RawDataset.records` is an array. Before large-source support, approve a small bounded-read contract: allowlisted station/variant/label, record cursor, limit, and explicit continuation/coverage metadata. Bind a query in a factory or add a request argument; choose one approach, not parallel APIs. Never return a page while implying it is the entire dataset.
- Validation currently has `not-run`/`completed`, but no explicit partial-scan status or paged issue log. Add scope (selected files/records), completeness, issue totals, and continuation/log references before truncating results. Distinguish checks not performed from checks that passed. Syntax failures must not become a misleading `empty` result.
- `ready` means records loaded, not free of validation issues. Fatal header/structure failures should return an error; recoverable invalid cells retain tokens and issues. Specify behavior for a parse error after partial progress and do not silently publish partial success.
- `DerivedDataset` requires an executed processing audit. Do not construct it merely to display raw records or relabel proposed cleaning as executed. Future display projections need separately approved transformation rules and an honest execution record. Registry metadata is a snapshot, not a runtime processing log.
- Full provenance and duplicate groups may be large. Keep full audit information server-side with retrievable references; approved browser projections retain source identity, attribution, limitations, and coverage without serializing every source path. Preserve exact source references internally and do not leak machine-specific absolute paths.

## Adapter-by-adapter plan

### 1. Crop Recommendation CSV

**Source:** `data/raw/crop-recommendation/Crop_recommendation.csv`, 150,034 bytes. Report: 2,200 rows, eight columns, zero missing cells/duplicates, 22 labels with 100 records each.

**Exact header:** `N,P,K,temperature,humidity,ph,rainfall,label`.

**Parse and validate:** comma-separated quoted-text parser; preserve string tokens before conversion. Check exact ordered header and row width. Validate `N`, `P`, `K` as integers and the next four fields as finite decimals; `label` remains source text. Compare labels and counts with the report as a drift check, not a rule to rebalance data. Do not use permissive conversions that turn empty strings into zero or accept numeric prefixes of malformed text.

**Missing/duplicates:** retain and flag any new missing/invalid values. Report exact full-row duplicate groups and source record numbers; never deduplicate by matching features or crop names. No interpolation: no temporal sequence is established.

**Possible future UI:** bounded source-record table, inspected label counts, and validation/coverage summary in a dataset demonstration. No crop recommendation engine, current farm readings, geographic map, risk score, or advisory follows from this CSV alone.

**Performance:** a guarded full read is reasonable for this small file on Node, but use the common streaming parser where practical. Proposed file cap: 1 MiB for the initial small-CSV reader; fail explicitly on growth, not truncate. Return paginated rows, not the entire table to every client.

**Provenance/unresolved:** retain source URL, file hash when actually computed, original row, source labels, and unknown units. Observed versus generated origin, nutrient definitions, measurement context, license and attribution remain unresolved.

### 2. Edge Agricultural Sensor CSV

**Source:** `data/raw/edge-agricultural-sensor/agriculture_dataset_with_target.csv`, 176,771 bytes. Report: 2,000 rows, no missing cells/duplicate rows, unique hourly timestamps.

**Exact header:** `Record_ID,Timestamp,Soil_Moisture,Soil_Temperature,Soil_pH,Humidity,Air_Temperature,Solar_Radiation,Wind_Speed,NDVI_Index,5G_Latency_ms,Crop_Health`.

**Parse and validate:** comma-separated parser, exact header/12 fields; integer `Record_ID`; strict finite decimal validation for the nine measurement fields; explicit calendar parsing for `YYYY-MM-DD HH:MM:SS`. Keep timezone unspecified and original timestamp text; do not let JavaScript's default timezone conversion assign an instant. Check IDs, timestamp uniqueness/order/intervals, and source labels `High_Stress` (688), `Healthy` (679), `Moderate_Stress` (633). Counts/intervals are report baselines, not physical validity rules.

**Missing/duplicates:** separate missing values, invalid timestamps, repeated timestamps, repeated IDs, and exact duplicates. Retain all; neither average repeated times nor choose first/last. No filling or resampling.

**Possible future UI:** bounded historical record table, source-label distribution, and validation summaries. A historical field-versus-timestamp demonstration may be considered after timestamp/display semantics are approved, with unresolved units visibly stated. No current farm KPI, diagnosis, weather forecast, treatment, or mapping from `Crop_Health` to a risk score.

**Performance:** same proposed 1 MiB guarded read and paginated output as Crop; no image bytes or image joins. Reported time coverage is 2024-01-01 00:00:00 through 2024-03-24 07:00:00, not live telemetry.

**Provenance/unresolved:** only `5G_Latency_ms` states its unit in its header. Other units, timezone, station identity, record generation, label protocol, license, and any relationship to images remain unresolved.

### 3. Edge Agricultural Sensor image tree

**Source:** `data/raw/edge-agricultural-sensor/Images/Agricultural-crops/`. Report: 829 images across 30 crop-named directories, 560 `.jpg`, 255 `.jpeg`, 14 `.png`, 83,216,277 bytes. Exact directory labels are listed in the inspection report and were rechecked at the root; preserve case and punctuation.

**Schema boundary:** file inventory only: original relative path, source directory label, byte size, extension, and explicitly verified format/dimensions if an approved decoder is later used. These are planned manifest fields, not an existing source CSV schema. No sensor-record foreign key exists.

**Validation/missing/duplicates:** enumerate regular files with bounded concurrency. Flag unreadable/zero-byte files, unexpected extensions, and decode/format errors when decoding is implemented. Missing dimensions stay unknown until inspected. Streaming byte hashes can identify exact duplicate candidates; confirm bytes before claiming equality. Preserve originals and conflicting labels. No synthesis, relabeling, deletion, or sensor association.

**Possible future UI:** inventory counts and paginated source-label gallery after license and image-delivery approval. Do not expose filesystem paths as browser URLs. Labels are not diagnoses.

**Performance:** enumerate metadata without loading image contents; page inventory, decode lazily with byte/pixel limits, never base64-embed the entire tree. Image delivery or thumbnails need separate approval and, for hosted use, Member 1 coordination.

**Provenance/unresolved:** source image path/label and source identity remain attached. Labeling provenance, exact duplicates, full image validity, license and the absent CSV-image relationship remain unresolved.

### 4. PlantVillage image variants

**Source:** `data/raw/plantvillage/plantvillage dataset/`, separately selecting `color/`, `grayscale/`, or `segmented/`. Report: 54,305 / 54,305 / 54,306 images, 162,916 total, 38 source directories per variant, approximately 2.18 GB. Exact 38 labels and extension counts are in the inspection report.

**Schema boundary:** same planned inventory fields as Edge images, plus required variant. Directory labels are source-provided strings, not independently verified diagnoses. Variant is part of record identity, not a cosmetic display setting.

**Validation/missing/duplicates:** inventory and bounded decode checks per variant/label. Report byte duplicates within/across variants without deletion. Do not pair by position, counts, or assumed filename equivalence. Segmented `Grape___Esca_(Black_Measles)` has 1,384 files versus 1,383 in each other variant; retain the extra file and investigate identifiers. Missing pairings stay unknown, never synthesized.

**Possible future UI:** per-variant inventory and bounded source-label gallery. No disease prediction, accuracy claim, or claim that all variants are independent observations.

**Performance:** stream directory iteration; do not recursively materialize all bytes or all provenance entries in browser memory. A durable, paginated inventory/index for production needs an approved derived-artifact/backend phase. Until then permit bounded traversal with explicit incomplete coverage, not an apparently complete summary. Global duplicate scans run separately from interactive requests.

**Provenance/unresolved:** preserve variant, source path/label, source URL and limitations. Pairing keys, extra-file origin, label verification, exhaustive integrity, license and potential cross-variant evaluation leakage remain unresolved; no train/test split is planned.

### 5. Soil Moisture Daily text files

**Source:** the 42 `data/raw/soil-moisture/Daily/<station>.txt` files. Exact station basenames for both grains:

```text
CAF003 CAF007 CAF009 CAF019 CAF031 CAF033 CAF035 CAF061 CAF067 CAF075
CAF079 CAF095 CAF119 CAF125 CAF129 CAF133 CAF135 CAF139 CAF141 CAF163
CAF173 CAF197 CAF201 CAF205 CAF209 CAF215 CAF217 CAF231 CAF237 CAF245
CAF275 CAF308 CAF310 CAF312 CAF314 CAF316 CAF349 CAF351 CAF357 CAF377
CAF397 CAF401
```

**Exact tab-delimited header:** `Location`, `Date`, `VW_30cm`, `VW_60cm`, `VW_90cm`, `VW_120cm`, `VW_150cm`, `T_30cm`, `T_60cm`, `T_90cm`, `T_120cm`, `T_150cm`.

**Parse and validate:** tab delimiter (not arbitrary whitespace); exact 12 fields; preserve `NA`. Check station against filename, explicit `MM/DD/YYYY` calendar dates, and finite numeric-or-missing fields. Depth suffixes state centimeters; `VW` and `T` measurement meanings/units are not established. Compare date ordering and repeated `(Location, Date)` groups without declaring that key a proven primary key.

**Missing/duplicates:** report baseline is 140,532 rows, 645,405 missing measurement cells, zero duplicates. Retain missing measurements and dates with all measurements missing. Distinguish missing from invalid and observed zero. Do not interpolate, clip, fill, deduplicate, or drop fields for low coverage.

**Possible future UI:** per-station Daily coverage table and bounded historical records. A future series must show gaps, source field names, unknown units, and historical dates; no soil-moisture percentage inference or current farm KPI. No station map without geographic evidence.

**Performance:** stream one selected station at a time (3,346 rows per file in report), paginate records, calculate only approved structural coverage counts during a full validation scan. No measurement aggregation or merging with Hourly.

**Provenance/unresolved:** preserve grain, station filename, row reference, original date/values and source URL. Reported dates span 2007-04-20 through 2016-06-16. Measurement definitions, timezone/clock context, daily aggregation protocol, geography, missing-marker semantics, license remain unresolved.

### 6. Soil Moisture Hourly text files

**Source:** the same 42 basenames under `data/raw/soil-moisture/Hourly/`. Exact header is Daily's header with `Time` immediately after `Date` (13 fields).

**Parse and validate:** tab delimiter; Daily checks plus explicit `H:MM`/`HH:MM` clock parsing. Keep date/time timezone-unspecified, not UTC. Report ordering, gaps and repeated `(Location, Date, Time)` groups per station. Interval anomalies are review findings, not authorization to resample.

**Missing/duplicates:** report baseline is 3,373,658 rows, 15,648,564 missing cells including date/time, and 889 duplicates. `CAF201.txt` contains 81,194 rows; each other file contains 80,304. Retain all 890 trailing CAF201 rows: Location remains present while date, time and measurements are missing; 889 are repeats beyond the first. Keep them in a record-number view. Any later time-indexed view exclusion needs an approved rule and audit of all 890, not merely deduplication of 889.

**Possible future UI:** per-station Hourly coverage, bounded historical records, and a distinct unresolved-timestamp group. Time-series display awaits approved semantics; no gap bridging, station joins, inferred geography, or conversion into Daily measurements.

**Performance:** stream selected files (218,443,188 bytes total), never accumulate all 3.37 million rows. Cursor paging alone bounds output, not scan time; initial sequential scans must have work budgets and explicit continuation. Repeated random-access queries need a separately approved index keyed to an input fingerprint. Coverage/global duplicate validation is an explicit batch operation, not a render-time side effect.

**Provenance/unresolved:** same soil limitations, plus CAF201 trailing-record origin and exclusion decision. Preserve source grain and date/time strings. Do not interpret observed extremes as invalid without a dictionary.

## Shared validation and missing-data policy

All rules here remain proposed. Existing cleaning policies remain unexecuted.

- Preserve raw bytes and source tokens. Distinguish literal `NA` where verified, empty fields, absent fields, malformed text, valid zero, and missing timestamps. Do not apply a universal missing-token list without per-source evidence.
- Validate encoding/BOM and line endings explicitly; a sample header is not evidence of every record's encoding or quoting. Keep logical one-based data-record numbers independent of physical line numbers, because quoted CSV records can span lines.
- Validate headers before mapping objects; duplicate/missing/extra headers or malformed row boundaries must be surfaced, not silently discarded. Keep missingness and parsing errors separate. Strict finite-number checks cannot establish units or physical validity.
- Duplicate comparison must specify exact raw record-field equality versus parsed equality, retain groups and original references, and report occurrences versus excess copies. Do not deduplicate across sources, stations, grains or image variants. A repeated timestamp alone is not a duplicate record.
- Preserve originals for every exclusion. Any future approved derived exclusion records reason, rule, approval/evidence, source references and reconciled input/retained/excluded counts. A page/filter selection is not cleaning: disclose selection and coverage rather than calling omitted pages excluded records.
- No interpolation, imputation, clipping, unit conversion, resampling, diagnosis inference or measurement aggregation in initial loaders. Counts of structural issues may be computed in a separately authorized validation scan; distinguish those from agronomic summaries.
- Return fatal failures as errors, not zero counts or healthy/empty success. Keep source/version/fingerprint, checks performed/not performed, limitations and audit references available. File changes during a scan invalidate that scan's completeness claim.

## Dependencies and operational limits

`package.json` contains Next, React, React DOM, Recharts, lucide-react, and styling/lint/TypeScript tooling. It declares no CSV parser. A targeted lockfile search found no `csv-parse`, `papaparse`, or `d3-dsv` entry. Recharts is a chart library, not an ingestion contract; do not depend on incidental transitive parsers.

**Proposed dependency approval:** use `csv-parse` for CSV and tab-delimited text, with streaming, explicit delimiter, no automatic casting/trimming/skipping, and record-size limits. Its documented raw-record and parsing-info options support traceability, but lexical field tokens still need a deliberate preservation design. Do not implement CSV as `split(',')`. Review the selected version, license, security and tests before adding it. No package is installed by this plan. See [parser options](https://csv.js.org/parse/options/) and [stream API](https://csv.js.org/parse/api/).

Node filesystem iteration/streams and crypto are sufficient for future inventory and hashing without another dependency. Image decoding is separate: choose and review a maintained decoder only when exhaustive integrity or thumbnails are authorized. Do not rely on an undeclared transitive image package. Verify the `server-only` boundary against this installed Next version during implementation and request approval for any direct package declaration needed.

Proposed initial engineering budgets, not dataset facts: 100 records per UI page, hard cap 500; 1 MiB serialized response budget; one soil file scanned at a time; at most two concurrent image reads. Enforce byte and time limits in addition to row limits; benchmark before approval for production. Do not allocate an unbounded in-memory duplicate set: use per-file bounded work, or an approved disk-backed audit/index for exhaustive checks. Never claim exhaustive validation when a budget stopped it. Cap rendered issue details while retaining complete counts and an accessible full audit.

## Security and provenance boundaries

- Accept known dataset IDs and allowlisted station/variant/label selections, never user-supplied arbitrary paths. Resolve real paths under the allowed root; reject traversal, unexpected symlinks/reparse targets and nonregular files. Use read-only handles.
- Raw data, credentials, filesystem error details, and full archive manifests do not belong in browser bundles or public assets. Escape source labels as text; no raw HTML interpretation. Future spreadsheet exports would need separate formula-injection safeguards.
- Preserve attribution, Kaggle source URL, original relative record/image references, known time coverage, unknown units and review status. Compute fingerprints only in an approved execution; never populate invented hashes, license names or source versions.
- Hosted deployment must explicitly provision licensed storage outside the code bundle and define runtime read permissions. Local existence does not imply deployment availability. No fetching Kaggle data or credentials at request/build time.
- Review each source's license and permitted use before redistribution or publication. Keep all six asset contexts under their four source identities. Every future demonstration must identify static dataset origin; none establishes farm ownership, live telemetry, risk resolution or machinery actions.

## Decisions requiring approval

1. Local Node demonstration versus hosted Member 1 storage/service ownership and deployment target.
2. The bounded query/result and validation-scope contract extensions above, including audit retrieval and partial failure semantics.
3. Parser dependency/version and resource budgets; image decoding/delivery remains a separate choice.
4. Initial output: recommend provenance, coverage and record browsing only. Approve any later chart projection or aggregation separately.
5. Source licenses/attribution, versions, units, timestamp semantics, label provenance and any verified relationships. Unknowns may remain explicitly unknown in record browsing, but must block unsupported interpretations.
6. Any execution of cleaning policies, including CAF201 exclusions, requires separate approval; this plan does not grant it.

## Ordered implementation phases and acceptance gates

1. Approve architecture, dependency and contract changes. Confirm deployment ownership and licensing restrictions. No UI change required.
2. Implement shared read-only parsing/path guards and Crop loader first. Test against actual source records without altering them; check headers, known counts, provenance, missing/invalid distinctions and absent-file errors. Artificial parser edge-case inputs, if desired, require explicit approval and must never become dataset records.
3. Implement Edge CSV with strict timezone-unspecified parsing and separate ID/timestamp/row checks. Confirm no CSV-image join and no label-to-risk inference.
4. Implement Edge image inventory, then bounded PlantVillage variant inventory. Keep decoding, thumbnails, global hashes and indexes separately scoped; show partial inspection honestly.
5. Implement Daily per-station reader, then Hourly streaming reader. Verify CAF201 records survive unchanged and pagination preserves original record numbering. Test cancellation, oversize limits and drift without modifying raw files.
6. Run separately approved exhaustive validation jobs and audit persistence only after memory/time budgets are measured. Compare with report baselines, explain differences; never force agreement by cleaning.
7. Only after a further UI/integration approval, project bounded outputs into clearly labeled dataset demonstrations. Retain existing farm unavailable states unless real farm context and verified meaning are provided. Coordinate any hosted endpoint with Member 1.

For implementation phases, run type-check/lint, tests of source identity and server/client boundaries, and memory/response-size checks. Run production builds only with an isolated build directory or safely stopped development server; never mix dev and production `.next` artifacts. No such implementation or build is performed by this plan.

## Verification of this planning change

Read-only repository/document reads and source-header/directory checks completed successfully. Both CSV headers matched the report; sample soil files used tabs and literal `NA`; expected Edge directory labels and PlantVillage variants were present. Full inventory statistics remain attributed to the inspection report, not newly recomputed. Existing registry and adapter contracts were reviewed unchanged. Only this Markdown plan was created; no dependencies, raw data, application code, registry, contracts, APIs or UI were changed. No lint/type-check/build was needed for this documentation-only change.
