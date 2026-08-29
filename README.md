# NFL Snap Atlas

NFL Snap Atlas is a static React website for exploring team snap counts, visual depth charts, and player history. It does not require a database or manual file uploads in the browser.

## What is included

- Team and season browsing for snap-count data
- Offense and defense depth-chart formations
- Drag-and-drop formation positions with saved team/unit layouts
- Offense, defense, and special-teams workload views
- Historical player panels
- Responsive desktop and mobile layouts
- A validated, command-driven data preparation step
- Render static-site configuration

The current source snapshot contains snap counts for 2012–2025 and current 2026 depth charts.

## Local development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

The development command validates and prepares the data before starting Vite.

Create a production build with:

```bash
npm run build
```

## Updating the data

The hosted browser is read-only. Collection runs locally from commands, writes canonical source files under `data/source`, and then creates `public/data/nfl-data.json` for the static site.

Collect one season of snap counts, the current depth charts, and regenerate the application data in one command:

```bash
npm run collect:data -- 2025
```

The snap-count collector downloads nflverse's game-level Pro Football Reference release, keeps regular-season games, aggregates them into player-team season totals, and preserves the stable PFR player ID. The depth-chart collector downloads the current all-team page from Ourlads and updates `depthChartSeason` automatically.

The collectors can also run independently:

```bash
npm run collect:snap-counts -- 2025
npm run collect:depth-charts
```

To rebuild from existing local source files without downloading depth charts, run:

```bash
npm run prepare-data
```

After collecting, start the development server or run the production build and review the result.

The collectors validate season, team coverage, minimum record counts, player IDs, and depth-chart completeness before replacing an existing source file. The generator validates every source file again before building the browser payload.

### Snap-count columns

Required columns:

```text
pos, offense, off_pct, defense, def_pct, special_teams,
st_pct, player_id, player_name, team
```

Each `data/source/snap-counts/YYYY.csv` file represents one season. `player_id` is required and is used as the historical player identity throughout the application.

### Depth-chart structure

The JSON is keyed by the Pro Football Reference-style team code. Each team contains `offense` and `defense` objects, with arrays of players under each position:

```json
{
  "crd": {
    "offense": {
      "QB": [{ "num": "7", "name": "Brissett, Jacoby" }]
    },
    "defense": {}
  }
}
```

## Project structure

```text
data/source/snap-counts/ One canonical CSV per collected season
data/source/             Current depth charts and source configuration
scripts/collect-*.mjs    Snap-count and depth-chart collectors
scripts/prepare-data.mjs Validation and browser-data generator
src/components/          Depth chart, player list, and history interface
src/lib/                 Team metadata and data helpers
public/data/              Generated app data; ignored by Git
render.yaml               Render static-site Blueprint
```

## Render deployment

The included `render.yaml` defines a static site with:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Automatic pull-request previews
- Long-lived caching for hashed frontend assets

Connect this repository as a Render Blueprint when it is ready to publish. No PostgreSQL instance or runtime server is required.

## Known data limitation

Depth-chart records currently contain names and jersey numbers but no shared player IDs. The app normalizes those names when matching the current roster to the selected snap season and labels unmatched players instead of displaying a misleading zero. Adding `player_id` to both upstream sources is the long-term fix.

## Data sources and attribution

- Snap counts: [nflverse](https://github.com/nflverse/nflverse-data), sourced from Pro Football Reference and published under CC BY 4.0.
- Depth charts: [Ourlads](https://www.ourlads.com/nfldepthcharts/depthcharts.aspx).

The frontend contains no data-upload or mutation capability. Source updates happen through the local collection commands and reach Render only after the repository changes are reviewed and pushed.
