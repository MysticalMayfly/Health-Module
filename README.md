# LifeOS: Health module

The first module of a personal Life OS. It is built around the **198 journey**:

> 1% disease tip · 99 causes of disease · 99 causes of health · 1% pinnacle.

Every outcome is the visible tip of an iceberg. The app tracks the 99% underneath, which it organises into four layers:

- **L1 Inputs**
- **L2 Signals**
- **L3 Markers**
- **L4 Outcomes**

Your position, from −99 to +99, is calculated as *(health causes in place) − (disease causes active)*, scored across 99 concrete factors.

## Run

```bash
npm install
npm run dev        # API on :3001 + Vite on :5173 (proxied)
# or production:
npm start          # builds the client and serves everything on :3001
```

On first launch you go through onboarding. Choose **"Explore with 180 days of demo data"** to see every dashboard populated.

Requires **Node 22.5+**. It uses the built-in `node:sqlite`, so there's no native build step. Data lives in `./data/` by default; set `LIFEOS_DATA=/path` to change it.

## Architecture

```
server/
  index.js              REST API: generic CRUD, /api/bundle, foods, photos, ingest, export/import
  db.js                 SQLite schema (entries, food_logs, foods, sleep, workouts, labs, records, actions…)
  foods-external.js     USDA FoodData Central + Open Food Facts (search, barcode)
  seed/foods.js         ~200 starter foods (Indian + global), per 100 g
  seed/demo.js          deterministic 180-day demo journey
  ingest/
    canonical.js        the data contract: canonical metrics, units, aggregation, validation
    engine.js           adapter.normalize → aggregate → validate → dedupe/inject → log run
    adapters/           appleHealth (export.xml + JSON webhook), googleFit (OAuth/REST),
                        healthConnect (JSON webhook), csv
shared/                 used by both server and client
  catalog.js            every metric: unit, layer (L1–L4), domain, aggregation
  actions.js            daily-action library, by phase (Repair → Stabilize → Build → Optimize)
  labs.js               biomarker catalog with reference + optimal ranges
  units.js              kg/lb, cm/in, mg/dL ↔ mmol/L (glucose, cholesterol, triglycerides)
src/
  lib/analytics.js      EMA trend, adaptive TDEE, forecast, baselines, drift alerts, readiness,
                        training stats, action auto-checks, correlations, insights
  lib/factors.js        THE 99 factors (each one evaluates to true / false / unknown)
  lib/journey.js        zones, onboarding → recommended actions
  pages/                22 pages + onboarding + printable doctor summary
```

**Adding a device source** means writing one file in `server/ingest/adapters/` that exports `{ id, name, normalize(payload) }` and returns canonical `{ samples, sleep, workouts }`.

## Food database coverage

The ~200 starter foods are approximate values for common home recipes. For HealthifyMe-level coverage, add these sources:

| Source | What it covers | How |
|---|---|---|
| USDA FoodData Central | ~400k foods with full micronutrients | Built in (search tab). Free API key in Settings. |
| Open Food Facts | ~3M packaged products, barcodes, NOVA | Built in (search + barcode tabs) |
| IFCT 2017 (NIN) | Indian raw ingredients | CSV import (Integrations) |
| Indian Nutrient Databank | ~1,000 cooked Indian recipes | CSV import (Integrations) |
| Your own foods | Labels and family recipes | Create tab and recipe builder |

## Health-platform notes

- **Apple Health** has no web API. Upload `export.xml`, or POST JSON from an exporter app to `/api/ingest/apple-health`.
- **Health Connect** (Android) is on-device only. A companion app or exporter POSTs records to `/api/ingest/health-connect`.
- **Google Fit** REST is deprecated by Google. The adapter works while your project still has access.
