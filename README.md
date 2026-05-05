# Chicago Crime Story 2025

Interactive InfoVis final project built with Next.js, React, and D3.

## Features

- Geo-style district bubble map based on district centroids
- Monthly timeline for citywide or selected-district trends
- Crime-type-by-district heatmap
- Hover tooltips and coordinated interactions
- Storytelling summary cards plus exploration controls

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open `http://localhost:3000`

## Data preprocessing

The processed JSON files are already included under `data/processed`.

If you want to regenerate them from the raw CSV:

```bash
npm run preprocess:data
```

## Deployment

This project is ready to upload to Vercel as a standard Next.js app.
