# Snap Atlas

Snap Atlas is a static React website for exploring NFL snap counts and visual depth charts, plus college football depth charts, high-school recruiting ratings, and transfer-portal ratings. It does not require a database or manual file uploads in the browser.

## What is included

- Team and season browsing for snap-count data
- Offense and defense depth-chart formations
- Drag-and-drop formation positions with saved team/unit layouts
- Offense, defense, and special-teams workload views
- Historical player panels
- An NFL/College switch in the shared site header
- Power Four and Notre Dame college depth charts
- On3 high-school recruiting profiles with a gold star for On3 five-star recruits
- Separate On3 transfer ratings and prior-team context when a portal match is available
- Responsive desktop and mobile layouts
- A validated, command-driven data preparation step
- Render static-site configuration

The current source snapshot contains NFL snap counts for 2012–2025, current 2026 NFL depth charts, and current 2026 college depth charts and talent data.

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

Collect one NFL season of snap counts, the current NFL depth charts, and regenerate the NFL application data in one command:

```bash
npm run collect:data -- 2025
```

The snap-count collector downloads nflverse's game-level Pro Football Reference release, keeps regular-season games, aggregates them into player-team season totals, and preserves the stable PFR player ID. The depth-chart collector downloads the current all-team page from Ourlads and updates `depthChartSeason` automatically.

The collectors can also run independently:

```bash
npm run collect:snap-counts -- 2025
npm run collect:depth-charts
```

Collect the 2026 college dataset with:

```bash
npm run collect:college-data -- 2026
```

That command collects current Ourlads depth charts for the ACC, Big Ten, Big 12, SEC, and Notre Dame. It then matches those players to On3 roster, high-school recruiting, and transfer-portal records. The generated canonical source is `data/source/college/2026.json`.

The gold star is intentionally narrow: it appears only when the player's native On3 high-school recruiting record has five stars. A five-star transfer rating never creates the gold high-school star. High-school and portal ratings remain separate in the player panel.

To rebuild both browser bundles from existing local source files without downloading anything, run:

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
data/source/snap-counts/ One canonical NFL CSV per collected season
data/source/college/     Canonical college JSON by season
data/source/             Current NFL depth charts and source configuration
scripts/collect-*.mjs    Snap-count and depth-chart collectors
scripts/prepare-*.mjs    Validation and browser-data generators
src/components/          Depth chart, player list, and history interface
src/lib/                 Team metadata and data helpers
public/data/             Generated NFL and college app data; ignored by Git
render.yaml               Render static-site Blueprint
```

## Render deployment

The included `render.yaml` defines a static site with:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Automatic pull-request previews
- Long-lived caching for hashed frontend assets

Connect this repository as a Render Blueprint when it is ready to publish. No PostgreSQL instance or runtime server is required.

## Known data limitations

Depth-chart records currently contain names and jersey numbers but no shared player IDs. The app normalizes those names when matching the current roster to the selected snap season and labels unmatched players instead of displaying a misleading zero. Adding `player_id` to both upstream sources is the long-term fix.

College depth-chart and recruiting sources also lack a shared player ID. The collector normalizes names and uses an unambiguous first-initial/last-name fallback; unmatched depth-chart players remain visible and are labeled as unrated rather than assigned invented recruiting data.

## Data sources and attribution

- Snap counts: [nflverse](https://github.com/nflverse/nflverse-data), sourced from Pro Football Reference and published under CC BY 4.0.
- Depth charts: [Ourlads](https://www.ourlads.com/nfldepthcharts/depthcharts.aspx).
- College depth charts: [Ourlads NCAA Football](https://secure.ourlads.com/ncaa-football-depth-charts/default.aspx).
- College recruiting and transfer ratings: [On3](https://www.on3.com/rivals/rankings/industry-player/football/2026/) and the [On3 Transfer Portal](https://www.on3.com/transfer-portal/top/football/2026/).

The frontend contains no data-upload or mutation capability. Source updates happen through the local collection commands and reach Render only after the repository changes are reviewed and pushed.
