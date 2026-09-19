# FarmOps AI — Research Datasets

This directory contains research and evaluation datasets used by the FarmOps AI advisory engine and dataset explorer.

> **Note**: Raw dataset files under data/raw/ contain ~2.5 GB of imagery and time-series files across 163,000+ files and are excluded from Git tracking via .gitignore.

## Dataset Provenance & Sources

| Dataset | Records / Size | Source URL | Local Path |
| :--- | :--- | :--- | :--- |
| **Field-Scale Soil Moisture** | 3.5M+ rows (42 stations) | [Kaggle Dataset](https://www.kaggle.com/datasets/sathyanarayanrao89/soil-moisture-data-from-field-scale-sensor-network) | data/raw/soil-moisture/ |
| **Crop Recommendation** | 2,200 rows (22 crops) | [Kaggle Dataset](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset) | data/raw/crop-recommendation/ |
| **PlantVillage Disease Imagery** | 162,916 images | [Kaggle Dataset](https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset) | data/raw/plantvillage/ |
| **Edge Agricultural Sensors** | 2,000 rows + 829 images | [Kaggle Dataset](https://www.kaggle.com/datasets/colabsss/edge-assisted-agricultural-sensor-dataset) | data/raw/edge-agricultural-sensor/ |

## Local Directory Structure

`
data/
├── README.md                      # This dataset provenance guide
└── raw/                           # Raw downloaded archives (gitignored)
    ├── crop-recommendation/
    │   └── Crop_recommendation.csv
    ├── edge-agricultural-sensor/
    │   ├── agriculture_dataset_with_target.csv
    │   └── Images/
    ├── plantvillage/
    │   └── plantvillage dataset/
    └── soil-moisture/
        ├── Daily/
        └── Hourly/
`

For complete structural audits, column analyses, and verification findings, refer to docs/datasets/README.md.
