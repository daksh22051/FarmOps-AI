# FarmOps AI dataset inspection

Inspection date: 2026-09-19

This report records the files currently present under `data/raw/`. It does not establish that any source is live farm data, validate medical or agronomic claims, or authorize redistribution. The four sources remain separate datasets.

## Sources and inspection status

| Dataset | Source | Local status | Integration Status |
| --- | --- | --- | --- |
| Soil Moisture Data from Field Scale Sensor Network | [Kaggle](https://www.kaggle.com/datasets/sathyanarayanrao89/soil-moisture-data-from-field-scale-sensor-network) | Present and inspected | Daily & Hourly streaming adapters implemented; dashboard connected |
| Crop Recommendation Dataset | [Kaggle](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset) | Present and inspected | Real adapter implemented; dashboard connected |
| PlantVillage Dataset | [Kaggle](https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset) | Present and inspected | 3-variant inventory adapter implemented; dashboard connected |
| Edge Assisted Agricultural Sensor Dataset | [Kaggle](https://www.kaggle.com/datasets/colabsss/edge-assisted-agricultural-sensor-dataset) | Present and inspected | CSV and image tree adapters implemented; dashboard connected |

No local license, citation, data dictionary, or source README was found in these four directories. Kaggle source terms were not checked during this filesystem inspection. Review the current source attribution, license, and redistribution terms before integration or sharing.

## 1. Crop Recommendation Dataset

### Files and format

- `data/raw/crop-recommendation/Crop_recommendation.csv`
- Size: 150,034 bytes
- Format: comma-separated text with one header row
- Records: 2,200
- Duplicate rows: 0
- Missing cells: 0

### Schema

| Column | Inferred storage type | Observed range or values |
| --- | --- | --- |
| `N` | integer | 0 to 140 |
| `P` | integer | 5 to 145 |
| `K` | integer | 5 to 205 |
| `temperature` | decimal | 8.825674745 to 43.67549305 |
| `humidity` | decimal | 14.25803981 to 99.98187601 |
| `ph` | decimal | 3.504752314 to 9.93509073 |
| `rainfall` | decimal | 20.21126747 to 298.5601175 |
| `label` | text | 22 distinct directory-style crop labels |

The file does not state units for `N`, `P`, `K`, `temperature`, `humidity`, or `rainfall`. Do not assign units without source documentation.

Each label occurs exactly 100 times: `apple`, `banana`, `blackgram`, `chickpea`, `coconut`, `coffee`, `cotton`, `grapes`, `jute`, `kidneybeans`, `lentil`, `maize`, `mango`, `mothbeans`, `mungbean`, `muskmelon`, `orange`, `papaya`, `pigeonpeas`, `pomegranate`, `rice`, and `watermelon`.

Representative first record:

```text
N=90, P=42, K=43, temperature=20.87974371, humidity=82.00274423,
ph=6.502985292000001, rainfall=202.9355362, label=rice
```

Data-quality notes: all 2,200 temperature, humidity, pH, and rainfall values are unique in this file. The balanced label counts and numeric precision should be reviewed against the source documentation before treating the records as field observations.

## 2. Edge Assisted Agricultural Sensor Dataset

### Tabular file

- `data/raw/edge-agricultural-sensor/agriculture_dataset_with_target.csv`
- Size: 176,771 bytes
- Records: 2,000
- Duplicate rows: 0
- Missing cells: 0
- `Record_ID`: integer values 1 through 2,000; 2,000 unique values
- `Timestamp`: 2,000 unique, parseable hourly values from `2024-01-01 00:00:00` through `2024-03-24 07:00:00`; timezone not stated

| Column | Inferred storage type | Observed range or values |
| --- | --- | --- |
| `Record_ID` | integer | 1 to 2,000 |
| `Timestamp` | text parsed as datetime | 2024-01-01 00:00:00 to 2024-03-24 07:00:00 |
| `Soil_Moisture` | decimal | 5.13 to 44.99 |
| `Soil_Temperature` | decimal | 10.00 to 34.99 |
| `Soil_pH` | decimal | 5.50 to 8.00 |
| `Humidity` | decimal | 30.02 to 94.96 |
| `Air_Temperature` | decimal | 15.00 to 39.99 |
| `Solar_Radiation` | decimal | 200.13 to 999.74 |
| `Wind_Speed` | decimal | 0.21 to 9.99 |
| `NDVI_Index` | decimal | 0.20 to 0.95 |
| `5G_Latency_ms` | decimal | 1.00 to 9.99 |
| `Crop_Health` | text | `High_Stress` 688; `Healthy` 679; `Moderate_Stress` 633 |

Only `5G_Latency_ms` states a measurement unit in the header. Units for the other numeric fields are unresolved. `Crop_Health` is a source-file label, not a diagnosis verified by this inspection.

Representative first record:

```text
Record_ID=1, Timestamp=2024-01-01 00:00:00, Soil_Moisture=19.98,
Soil_Temperature=16.54, Soil_pH=6.93, Humidity=72.14,
Air_Temperature=33.01, Solar_Radiation=498.91, Wind_Speed=6.61,
NDVI_Index=0.255, 5G_Latency_ms=1.04, Crop_Health=Healthy
```

### Image tree

- Root: `data/raw/edge-agricultural-sensor/Images/Agricultural-crops/`
- Images: 829 (560 `.jpg`, 255 `.jpeg`, 14 `.png`)
- Total size: 83,216,277 bytes; individual files range from 2,856 to 1,844,048 bytes
- No non-image metadata files were found inside `Images/`
- Sample files opened successfully as JPEG/PNG; observed dimensions varied, including 275x183, 800x546, and 1665x1245

| Directory name | Images | Directory name | Images |
| --- | ---: | --- | ---: |
| `almond` | 21 | `banana` | 31 |
| `cardamom` | 22 | `Cherry` | 32 |
| `chilli` | 23 | `clove` | 30 |
| `coconut` | 25 | `Coffee-plant` | 29 |
| `cotton` | 32 | `Cucumber` | 31 |
| `Fox_nut(Makhana)` | 23 | `gram` | 25 |
| `jowar` | 30 | `jute` | 23 |
| `Lemon` | 28 | `maize` | 31 |
| `mustard-oil` | 28 | `Olive-tree` | 30 |
| `papaya` | 23 | `Pearl_millet(bajra)` | 39 |
| `pineapple` | 25 | `rice` | 29 |
| `soyabean` | 30 | `sugarcane` | 25 |
| `sunflower` | 24 | `tea` | 23 |
| `Tobacco-plant` | 33 | `tomato` | 26 |
| `vigna-radiati(Mung)` | 27 | `wheat` | 31 |

No manifest connects these 829 crop-folder images to the 2,000 sensor rows. Treat the CSV and image tree as separate assets unless source documentation supplies a verified relationship.

## 3. PlantVillage Dataset

### Image tree

- Root: `data/raw/plantvillage/plantvillage dataset/`
- Variant directories: `color`, `grayscale`, and `segmented`
- Counts: 54,305 color; 54,305 grayscale; 54,306 segmented; 162,916 total
- Extensions: 162,912 `.jpg`, 2 `.jpeg`, and 2 `.png`
- Total size: 2,180,207,308 bytes; individual files range from 1,100 to 121,652 bytes
- No non-image metadata files were found
- Three sampled segmented files opened as 256x256 RGB JPEG images

The directory names below are source-provided labels only. This inspection does not verify them as diagnoses.

| Source directory label | Color | Grayscale | Segmented |
| --- | ---: | ---: | ---: |
| `Apple___Apple_scab` | 630 | 630 | 630 |
| `Apple___Black_rot` | 621 | 621 | 621 |
| `Apple___Cedar_apple_rust` | 275 | 275 | 275 |
| `Apple___healthy` | 1,645 | 1,645 | 1,645 |
| `Blueberry___healthy` | 1,502 | 1,502 | 1,502 |
| `Cherry_(including_sour)___healthy` | 854 | 854 | 854 |
| `Cherry_(including_sour)___Powdery_mildew` | 1,052 | 1,052 | 1,052 |
| `Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot` | 513 | 513 | 513 |
| `Corn_(maize)___Common_rust_` | 1,192 | 1,192 | 1,192 |
| `Corn_(maize)___healthy` | 1,162 | 1,162 | 1,162 |
| `Corn_(maize)___Northern_Leaf_Blight` | 985 | 985 | 985 |
| `Grape___Black_rot` | 1,180 | 1,180 | 1,180 |
| `Grape___Esca_(Black_Measles)` | 1,383 | 1,383 | 1,384 |
| `Grape___healthy` | 423 | 423 | 423 |
| `Grape___Leaf_blight_(Isariopsis_Leaf_Spot)` | 1,076 | 1,076 | 1,076 |
| `Orange___Haunglongbing_(Citrus_greening)` | 5,507 | 5,507 | 5,507 |
| `Peach___Bacterial_spot` | 2,297 | 2,297 | 2,297 |
| `Peach___healthy` | 360 | 360 | 360 |
| `Pepper,_bell___Bacterial_spot` | 997 | 997 | 997 |
| `Pepper,_bell___healthy` | 1,478 | 1,478 | 1,478 |
| `Potato___Early_blight` | 1,000 | 1,000 | 1,000 |
| `Potato___healthy` | 152 | 152 | 152 |
| `Potato___Late_blight` | 1,000 | 1,000 | 1,000 |
| `Raspberry___healthy` | 371 | 371 | 371 |
| `Soybean___healthy` | 5,090 | 5,090 | 5,090 |
| `Squash___Powdery_mildew` | 1,835 | 1,835 | 1,835 |
| `Strawberry___healthy` | 456 | 456 | 456 |
| `Strawberry___Leaf_scorch` | 1,109 | 1,109 | 1,109 |
| `Tomato___Bacterial_spot` | 2,127 | 2,127 | 2,127 |
| `Tomato___Early_blight` | 1,000 | 1,000 | 1,000 |
| `Tomato___healthy` | 1,591 | 1,591 | 1,591 |
| `Tomato___Late_blight` | 1,909 | 1,909 | 1,909 |
| `Tomato___Leaf_Mold` | 952 | 952 | 952 |
| `Tomato___Septoria_leaf_spot` | 1,771 | 1,771 | 1,771 |
| `Tomato___Spider_mites Two-spotted_spider_mite` | 1,676 | 1,676 | 1,676 |
| `Tomato___Target_Spot` | 1,404 | 1,404 | 1,404 |
| `Tomato___Tomato_mosaic_virus` | 373 | 373 | 373 |
| `Tomato___Tomato_Yellow_Leaf_Curl_Virus` | 5,357 | 5,357 | 5,357 |

Data-quality concern: the segmented `Grape___Esca_(Black_Measles)` directory has one more file than its color and grayscale counterparts. Pairing across variants must use verified identifiers, not directory position or count.

## 4. Soil Moisture Data from Field Scale Sensor Network

### Files and formats

- `data/raw/soil-moisture/Daily/`: 42 tab-delimited `.txt` files, 8,663,938 bytes total; individual files range from 187,695 to 221,022 bytes
- `data/raw/soil-moisture/Hourly/`: 42 tab-delimited `.txt` files, 218,443,188 bytes total; individual files range from 4,864,838 to 5,490,238 bytes
- Both folders contain the same station filenames:

```text
CAF003, CAF007, CAF009, CAF019, CAF031, CAF033, CAF035, CAF061,
CAF067, CAF075, CAF079, CAF095, CAF119, CAF125, CAF129, CAF133,
CAF135, CAF139, CAF141, CAF163, CAF173, CAF197, CAF201, CAF205,
CAF209, CAF215, CAF217, CAF231, CAF237, CAF245, CAF275, CAF308,
CAF310, CAF312, CAF314, CAF316, CAF349, CAF351, CAF357, CAF377,
CAF397, CAF401
```

Daily schema: `Location`, `Date`, `VW_30cm`, `VW_60cm`, `VW_90cm`, `VW_120cm`, `VW_150cm`, `T_30cm`, `T_60cm`, `T_90cm`, `T_120cm`, `T_150cm`.

Hourly schema adds `Time` after `Date`. All 42 files in each folder share one parsed schema and one inferred type pattern. `Location`, date, and time fields parse as text; measurement fields parse as decimals after literal `NA` values are treated as missing.

The `30cm` through `150cm` suffixes explicitly identify depths in centimeters. The files do not define the measurement units or expanded meanings of `VW` and `T`, so no further unit interpretation is asserted here.

### Daily summary

- 3,346 rows per file; 140,532 rows total
- Dates parse from 2007-04-20 through 2016-06-16 in every file
- Date parse failures: 0
- Duplicate rows: 0
- Missing measurement cells: 645,405
- Missing counts: `VW_30cm` 62,961; `VW_60cm` 65,344; `VW_90cm` 65,007; `VW_120cm` 64,747; `VW_150cm` 66,011; `T_30cm` 62,578; `T_60cm` 63,870; `T_90cm` 63,782; `T_120cm` 63,976; `T_150cm` 67,129
- Observed `VW_*` ranges: 0.063 to 0.688 across columns
- Observed `T_*` ranges: -9.1 to 28.19 across columns

Representative first row from `Daily/CAF003.txt`:

```text
CAF003  04/20/2007  NA  NA  NA  NA  NA  NA  NA  NA  NA  NA
```

### Hourly summary

- 41 files have 80,304 rows each
- `CAF201.txt` has 81,194 rows
- 3,373,658 rows total
- Valid dates span 2007-04-20 through 2016-06-16
- Missing cells: 15,648,564, including 890 missing dates and 890 missing times
- Duplicate rows: 889, all in `CAF201.txt`
- Observed `VW_*` ranges: 0.004 to 1.01 across columns
- Observed `T_*` ranges: -9.1 to 29.0 across columns

`Hourly/CAF201.txt` ends with 890 rows containing `CAF201` followed by `NA` for date, time, and every measurement. The first such row is unique relative to the valid data and the remaining 889 rows are duplicates of it. Do not silently drop or impute these records before an explicit cleaning policy is approved.

Representative first row from `Hourly/CAF003.txt`:

```text
CAF003  04/20/2007  0:00  NA  NA  NA  NA  NA  NA  NA  NA  NA  NA
```

## Cross-source integrity rules

- Do not present these datasets as live readings from one farm. They have different structures, time coverage, identifiers, labels, and provenance.
- Do not join sources by crop label, folder name, row order, or timestamp without documented and verified keys.
- Image directory names and `Crop_Health` values are source-provided labels, not independently verified diagnoses.
- Preserve raw files unchanged. Define missing-value, duplicate, range-validation, and train/test separation policies before creating processed data.
- The PlantVillage variants may represent related renditions of the same underlying images. Prevent cross-variant leakage before any evaluation split.

## Unresolved questions before integration

1. What licenses, attribution text, versions, and redistribution limits apply to each Kaggle source?
2. What units and measurement protocols apply to all numeric columns without unit-bearing headers?
3. What do `VW` and `T` expand to, and how were the soil depths sampled and aggregated?
4. Are the crop-recommendation and edge-sensor records observed, generated, or otherwise transformed?
5. Is there a documented relationship between the Edge CSV records and its crop image folders?
6. Why does PlantVillage segmented `Grape___Esca_(Black_Measles)` contain one extra file?
7. Why does hourly `CAF201.txt` contain 890 trailing all-missing records, and should they be excluded under the source protocol?
8. What geographic coordinate system or station metadata, if any, maps the `CAF` identifiers to locations? No latitude or longitude fields were found in these files.

## Proposed Cleaning and Validation Policies

Review date: 2026-09-19. **Every policy below is proposed, not yet executed.** This review uses the inspection findings above; it does not repeat the raw-file inspection or claim that any data has been cleaned. Structural checks described as feasible now are recommendations, not newly completed checks.

### Shared handling and provenance

**Verified observations:** The inspection found no local data dictionary, unit documentation, geographic coordinates, or license documentation. The sources have different schemas and contexts. Source URLs and inspection evidence are retained above.

**Proposed processing rules — proposed, not yet executed:**

- Keep raw files immutable. Future outputs must be separate derived artifacts with a source identifier, source URL/version where known, file path, source checksum, original row number or image path, processing version, and recorded decisions.
- Preserve literal source values and distinguish missing tokens, empty fields, malformed values, and real zeroes. A future parsed null must retain its original token and reason. Never convert a parse failure or missing measurement to zero.
- Report exact row duplicates within each source file, including group membership, source row references, total occurrences, and excess occurrences beyond the first. Define raw-field equality separately from equality after parsing or normalization; do not silently trim, round, or case-fold before comparison. Do not deduplicate across sources or sampling grains.
- Any future exclusion must affect only a derived dataset and have an explicit use-specific rule, supporting evidence, reason, source references, and retained/excluded counts that reconcile to input counts. No row or field is excluded solely because it is incomplete or outside an observed range.
- Treat repeated timestamps as review groups. Preserve all records and examine source, station, sampling grain, identifiers, timezone, and conflicting values before deciding whether they represent duplication, simultaneous observations, or corrections. Do not automatically average them or keep the first/last.
- Prohibit interpolation, forward/back filling, and other imputation pending documented units, sampling context, timestamp semantics where applicable, and an approved method. Any later estimates must be distinguishable from observations and preserve missingness and method provenance.
- Treat inspected counts, labels, and numeric ranges as snapshot baselines. Report drift on future intake; do not force new data to match those counts or use observed minima/maxima as physical validity thresholds. Report malformed rows, unexpected columns, non-finite numbers, and unexpected labels explicitly.
- Review each source's license, attribution, version, permitted use, and redistribution terms before integration or publication. Keep the four datasets and their contexts distinguishable. Label future views as dataset-derived demonstrations with source and time coverage; if simulation is later authorized, label it explicitly as simulated. Static records must not be described as live farm telemetry.

**Decisions requiring clarification:** Accepted missing tokens beyond those observed; record identity and correction semantics; documented units and validity limits; source versions and license terms; the intended use and evidence needed for any exclusion or estimation.

### Crop Recommendation

**Verified observations:** The report records 2,200 rows, eight columns, zero missing cells, zero duplicate rows, and 22 labels with 100 rows each. No timestamp or geographic field is documented in its schema. Units and whether records are observed or generated remain unresolved.

**Proposed processing rules — proposed, not yet executed:**

- Preserve every current record. For later missing fields, retain the row and flag the affected field. A record lacking a required input or label may be omitted from a specific derived analysis only after that analysis defines its required fields and logs the exclusion. Do not drop an entire column because some values are missing.
- Do not interpolate by row order: the schema establishes no temporal sequence. Do not infer missing inputs or labels from class balance, neighbouring rows, or other datasets; imputation remains prohibited pending context and an approved method.
- Check comma-separated parsing, eight fields per record, exact headers `N`, `P`, `K`, `temperature`, `humidity`, `ph`, `rainfall`, `label`, integer parsing for `N/P/K`, finite decimal parsing for `temperature`, `humidity`, `ph`, and `rainfall`, and nonempty text labels. Compare label membership and counts to the inspected baseline and report deviations without relabelling.
- Report exact duplicates if found in future intake. Without a documented observation key, matching feature values alone do not prove duplicated observations. Apply the shared derived-only exclusion and audit policy if removal is later justified.

**Decisions requiring clarification:** Units and meanings of the nutrient fields; environmental measurement context and period; record-generation method; label assignment and intended use. Range rejection, unit conversion, resampling, class rebalancing, and inferred crop recommendations require evidence beyond this inspection.

### Edge Agricultural Sensor CSV

**Verified observations:** The report records 2,000 rows, 12 columns, no missing cells or duplicate rows, unique `Record_ID` and `Timestamp` values, hourly timestamps, and three `Crop_Health` labels. Timezone is unspecified. `5G_Latency_ms` is the only header explicitly carrying a measurement unit.

**Proposed processing rules — proposed, not yet executed:**

- Preserve current records and any future missing measurements. Missing IDs, timestamps, or labels should produce separate flags. Exclude a row only from a derived operation that cannot use it under a documented rule; retain it in the audit record.
- Check exact headers against the 12-column schema above, row width, integer `Record_ID`, finite numeric measurements, timestamp parsing using the observed `YYYY-MM-DD HH:MM:SS` form, missingness, identifier uniqueness, and observed label membership (`Healthy`, `High_Stress`, `Moderate_Stress`). Record timestamp ordering and intervals; changes from the observed hourly spacing are review findings, not automatic errors to repair.
- Preserve timestamp strings and parsed timezone-unspecified values. Do not assign UTC or a local timezone. Report duplicate IDs, repeated timestamps, and exact full-row duplicates separately; do not infer a unique real-world event from a timestamp alone.
- Prohibit temporal interpolation, resampling, and feature or label imputation until timezone, sampling/collection context, units, and source-generation method are understood. Do not translate `Crop_Health` into a risk score, disease, treatment, or verified health assessment.

**Decisions requiring clarification:** Timezone, sensor/station context, physical units, ID semantics, label-generation rules, and whether records are generated or observed. Physical thresholds and cross-record aggregation remain undecided. No CSV-to-image join is justified by the existing report.

### Edge agricultural images

**Verified observations:** The report counts 829 images across 30 crop-named directories, with `.jpg`, `.jpeg`, and `.png` extensions and varying sample dimensions. No manifest links images to the sensor rows; the inspection only opened representative files.

**Proposed processing rules — proposed, not yet executed:**

- Preserve originals, exact paths, filename case, extensions, and directory labels. Keep missing metadata or unknown sensor associations unresolved; do not infer labels or row associations from filenames, crop names, or row order. Image synthesis or substitution is not an acceptable missing-data repair.
- Inventory per-directory counts and byte sizes; check readability, successful image decoding, actual format versus extension, dimensions, and channel modes. Record errors against the original path. Sample success does not certify every file; varied dimensions alone are not defects.
- Report byte-identical images by content hash and source paths. Similar-looking images are review candidates only. Conflicting directory labels need review, not automatic relabelling. A corrupt or duplicate image may be excluded only from a derived manifest under an approved, logged rule; never delete the original.
- Keep directory names as source labels without interpreting them as verified diagnoses. Any later resizing or format conversion must create a traceable derivative after requirements are defined.

**Decisions requiring clarification:** Image provenance and license, labeling protocol, whether any sensor-image mapping exists, and future image input requirements. Do not treat 829 as the expected number of independent observations without duplicate and provenance review.

### PlantVillage images

**Verified observations:** The report counts 162,916 files: 54,305 color, 54,305 grayscale, and 54,306 segmented, with 38 source directory labels. Segmented `Grape___Esca_(Black_Measles)` has 1,384 files versus 1,383 in each other variant. Representative segmented images were opened; exhaustive decoding and duplicate-image checks were not reported.

**Proposed processing rules — proposed, not yet executed:**

- Preserve originals and exact directory labels. Retain `color`, `grayscale`, and `segmented` as explicit variant identifiers in any future manifest; do not flatten the trees, overwrite variants, or count all variants as independent observations without evidence.
- Check image inventory, byte size, decoding, format, dimensions, and channel modes independently for each variant and label, using the shared image audit approach. Sample dimensions of 256x256 do not establish a mandatory size for every file.
- Report exact byte duplicates within and across variants with their paths. Preserve label conflicts and uncertain visual matches for review; no automatic deduplication, relabelling, or diagnosis inference.
- Investigate the extra segmented file by manifest comparison and verified source identifiers. Do not delete it to equalize counts, pair by directory order, or fabricate a missing counterpart. Any future paired subset may exclude unmatched records only under a documented, auditable pairing rule; keep unmatched assets available separately.
- If future evaluation is authorized, group verified renditions of the same underlying image together before splitting data. Unknown pairing must remain explicit and unresolved groups must not be assumed independent. No split, transformation, imputation, or training is performed under this proposal.

**Decisions requiring clarification:** Variant relationships and trustworthy pairing keys, the extra segmented file, label provenance, redistribution terms, and exhaustive image-integrity results. Folder names do not establish independently verified disease diagnoses.

### Soil Moisture — Daily and Hourly

**Verified observations:** The report records 42 tab-delimited `.txt` files per grain. Daily has 140,532 rows and 645,405 missing measurement cells, with no duplicate rows. Hourly has 3,373,658 rows and 15,648,564 missing cells. `Hourly/CAF201.txt` contains 890 trailing rows retaining `Location=CAF201` but missing date, time, and every measurement; 889 are repeats beyond the first. Valid dates span 2007-04-20 to 2016-06-16. Depth suffixes state centimeters; `VW`/`T` meanings and measurement units remain undocumented.

**Proposed processing rules — proposed, not yet executed:**

- Preserve `NA` and all other raw values, including all-missing measurement rows with valid timestamps. Represent missing measurements as unavailable in future derived views; do not replace them with zero or silently bridge gaps. Report coverage per source file, station, grain, depth, and measurement field.
- Check tab delimiter, row width, exact 12-column Daily and 13-column Hourly schemas, expected station filenames, nonempty `Location`, consistency between file and station identifier, finite numeric-or-missing measurement values, explicit `MM/DD/YYYY` dates, and Hourly `H:MM`/`HH:MM` times. Keep malformed strings and source row references in validation results. Missing timestamps and invalid nonmissing timestamps must be reported separately.
- Validate ordering and report gaps and repeated keys within each station and grain: `(Location, Date)` for Daily and `(Location, Date, Time)` for Hourly are candidate review keys, not assumed universal primary keys. Do not merge stations, infer geography, average repeats, or collapse Daily and Hourly into one series.
- For the 890 trailing `CAF201` rows, separately report missing timestamp/measurement status and the exact duplicate group (890 occurrences, 889 excess). Proposed eligibility for a future time-indexed view may exclude all 890 because no timestamp can position them, only after that use-specific rule is accepted and every exclusion is logged. This differs from deduplication alone, which would retain one equally unusable row. Keep all originals and audit counts; do not execute either exclusion now or infer why the rows exist.
- Exclude individual missing measurements only from a future calculation whose coverage and denominator rules explicitly require observed values; disclose included and missing counts. Do not discard a whole timestamp when another depth or field is available, or drop a sensor field solely for low coverage without documented criteria.
- Prohibit interpolation, imputation, unit conversion, percentage conversion, clipping, and aggregation between Hourly and Daily until measurement units, timezone, sampling and daily aggregation protocols are documented. The observed `VW` maximum of 1.01 and negative `T` values are review candidates, not proof of invalidity. Define no physical thresholds from the observed ranges.

**Decisions requiring clarification:** Station metadata/geography, timezone and clock conventions, measurement definitions and units, meaning of missing markers, sampling outages, Daily aggregation method, and the origin of the trailing `CAF201` rows. Any future interpolation must specify justified gap limits and avoid crossing stations, depths, or unsupported periods; those limits are not established here.

### Review verification and execution status
 
The verified-observation summaries in this section were checked against the existing inspection report above. This change adds documentation only. All cleaning, validation, hashing, exclusion, imputation, image decoding, and manifest policies in this section remain **proposed, not yet executed**. No raw records were removed or altered, no derived dataset or adapter was created, and source attribution/license notes remain intact.

## Member 2 Adapter Implementation & Dashboard Integration Status

Implementation Date: 2026-09-19

Real dataset adapters, streaming server data access, security path validators, and dashboard integration were implemented in `lib/data/server/` and `app/dashboard/`:

1. **Crop Recommendation CSV Loader (`lib/data/server/crop-adapter.ts`)**
   - Parses 2,200 records across 8 verified columns with zero missing values and zero duplicate rows.
   - Preserves uncoerced `DatasetValue` tokens. Computes exact ranges and means for N, P, K, temperature, humidity, pH, rainfall.
   - Connected to dashboard with 22-class badge directory and bounded streaming record pagination.

2. **Edge Sensor CSV Loader (`lib/data/server/edge-sensor-adapter.ts`)**
   - Parses 2,000 hourly observations from 2024-01-01 00:00:00 to 2024-03-24 07:00:00 without assuming a timezone.
   - Validates `Crop_Health` distribution: Healthy (679), Moderate_Stress (633), High_Stress (688).
   - Preserves `5G_Latency_ms` as the only column with a verified header unit (ms).
   - Connected to dashboard with historical telemetry table and health distribution breakdown.

3. **Edge Crop Images Loader (`lib/data/server/edge-images-adapter.ts`)**
   - Inventories 829 images across 30 crop-named directories.
   - Serves bounded specimen thumbnails securely via `/api/datasets/image` without exposing filesystem paths.
   - Notes that no manifest connects images to sensor CSV rows.

4. **PlantVillage Image Archive Loader (`lib/data/server/plantvillage-adapter.ts`)**
   - Inventories 162,916 images across `color` (54,305), `grayscale` (54,305), and `segmented` (54,306) variants.
   - Validates 38 condition categories across plant species.
   - Documents known anomaly: segmented `Grape___Esca_(Black_Measles)` has 1,384 files vs 1,383 in other variants.
   - Connected to dashboard with variant switcher and specimen thumbnail browser.

5. **Field Scale Soil Moisture Daily Loader (`lib/data/server/soil-daily-adapter.ts`)**
   - Streams 42 station tab-delimited files (140,532 total rows).
   - Preserves literal `NA` values (645,405 missing cells) without converting to zero or imputing.
   - Connected to dashboard with station dropdown and depth sensor missingness matrix.

6. **Field Scale Soil Moisture Hourly Loader (`lib/data/server/soil-hourly-adapter.ts`)**
   - Memory-bounded streaming reader for 3,373,658 hourly rows across 42 stations.
   - Detects and reports the 890 trailing all-missing records in `Hourly/CAF201.txt` as a reported anomaly while preserving raw data unchanged.
   - Connected to dashboard with streaming pagination.

### Remaining Limitations & Required Decisions
- Source licensing: Kaggle source terms, redistribution permissions, and formal attribution text remain unreviewed.
- Physical units: Units for nutrient fields (N, P, K), environmental fields, and sensor depth columns (`VW_*`, `T_*`) are undocumented in source files.
- Geography: Station identifiers (`CAF*`) lack geographic latitude/longitude metadata.
- Agronomic boundaries: FarmOps AI remains strictly an advisory and orchestrating interface; no real farm control, ML predictions, or clinical diagnoses are asserted.

