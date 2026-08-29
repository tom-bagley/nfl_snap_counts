import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const outputDir = path.join(rootDir, 'data', 'source', 'snap-counts');
const seasonArgument = process.argv.find((value) => /^20\d{2}$/.test(value));

if (!seasonArgument) {
  console.error('Usage: npm run collect:snap-counts -- 2025');
  process.exit(1);
}

const season = Number(seasonArgument);
const sourceUrl = `https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`;
const outputPath = path.join(outputDir, `${season}.csv`);
const temporaryPath = `${outputPath}.tmp`;

const TEAM_CODES = {
  ARI: 'crd', ATL: 'atl', BAL: 'rav', BUF: 'buf', CAR: 'car', CHI: 'chi', CIN: 'cin', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det', GB: 'gnb', HOU: 'htx', IND: 'clt', JAX: 'jax', KC: 'kan',
  LV: 'rai', OAK: 'rai', LAC: 'sdg', SD: 'sdg', LAR: 'ram', LA: 'ram', STL: 'ram', MIA: 'mia',
  MIN: 'min', NE: 'nwe', NO: 'nor', NYG: 'nyg', NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SEA: 'sea',
  SF: 'sfo', TB: 'tam', TEN: 'oti', WAS: 'was', WSH: 'was',
};
const TEAM_ORDER = [...new Set(Object.values(TEAM_CODES))];
const OUTPUT_FIELDS = [
  'pos', 'offense', 'off_pct', 'defense', 'def_pct',
  'special_teams', 'st_pct', 'player_id', 'player_name', 'team',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  if (quoted) throw new Error('Downloaded snap-count CSV has an unterminated quoted value.');
  return rows;
}

function integer(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace('%', ''));
  if (!Number.isFinite(parsed)) return 0;
  return parsed <= 1 ? parsed * 100 : parsed;
}

function csvValue(value) {
  const stringValue = String(value ?? '');
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function formattedPercentage(snaps, total) {
  return total > 0 ? `${((snaps / total) * 100).toFixed(2)}%` : '0%';
}

console.log(`Downloading ${season} game-level snap counts from nflverse...`);
const response = await fetch(sourceUrl, { headers: { accept: 'text/csv', 'user-agent': 'NFL-Snap-Atlas/1.0' } });
if (!response.ok) throw new Error(`nflverse snap-count request failed with status ${response.status}.`);
const csvText = await response.text();
const [headers, ...rawRows] = parseCsv(csvText);
const required = [
  'season', 'game_type', 'game_id', 'player', 'pfr_player_id', 'position', 'team',
  'offense_snaps', 'offense_pct', 'defense_snaps', 'defense_pct', 'st_snaps', 'st_pct',
];
const missing = required.filter((field) => !headers.includes(field));
if (missing.length > 0) throw new Error(`nflverse file is missing columns: ${missing.join(', ')}`);

const records = new Map();
const gameTotals = new Map();

for (const cells of rawRows) {
  const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  if (Number(row.season) !== season || row.game_type !== 'REG') continue;
  const team = TEAM_CODES[row.team];
  if (!team || !row.pfr_player_id || !row.player) continue;

  const gameTeamKey = `${row.game_id}|${team}`;
  const totals = gameTotals.get(gameTeamKey) ?? { offense: 0, defense: 0, specialTeams: 0 };
  for (const [snapsField, pctField, totalField] of [
    ['offense_snaps', 'offense_pct', 'offense'],
    ['defense_snaps', 'defense_pct', 'defense'],
    ['st_snaps', 'st_pct', 'specialTeams'],
  ]) {
    const snaps = integer(row[snapsField]);
    const pct = percentage(row[pctField]);
    if (snaps > 0 && pct > 0) totals[totalField] = Math.max(totals[totalField], Math.round(snaps / (pct / 100)));
  }
  gameTotals.set(gameTeamKey, totals);

  const key = `${row.pfr_player_id}|${team}`;
  const record = records.get(key) ?? {
    player_id: row.pfr_player_id,
    player_name: row.player,
    team,
    offense: 0,
    defense: 0,
    special_teams: 0,
    positions: new Map(),
    games: new Set(),
  };
  record.offense += integer(row.offense_snaps);
  record.defense += integer(row.defense_snaps);
  record.special_teams += integer(row.st_snaps);
  record.positions.set(row.position, (record.positions.get(row.position) ?? 0) + 1);
  record.games.add(row.game_id);
  records.set(key, record);
}

const teamSeasonTotals = new Map();
for (const [gameTeamKey, totals] of gameTotals) {
  const team = gameTeamKey.split('|')[1];
  const seasonTotals = teamSeasonTotals.get(team) ?? { offense: 0, defense: 0, specialTeams: 0 };
  seasonTotals.offense += totals.offense;
  seasonTotals.defense += totals.defense;
  seasonTotals.specialTeams += totals.specialTeams;
  teamSeasonTotals.set(team, seasonTotals);
}

const outputRows = [...records.values()].map((record) => {
  const position = [...record.positions.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? '';
  const totals = teamSeasonTotals.get(record.team);
  return {
    pos: position,
    offense: record.offense,
    off_pct: formattedPercentage(record.offense, totals?.offense),
    defense: record.defense,
    def_pct: formattedPercentage(record.defense, totals?.defense),
    special_teams: record.special_teams,
    st_pct: formattedPercentage(record.special_teams, totals?.specialTeams),
    player_id: record.player_id,
    player_name: record.player_name,
    team: record.team,
  };
});

const teams = new Set(outputRows.map((row) => row.team));
if (teams.size !== 32) throw new Error(`Expected 32 teams for ${season} but collected ${teams.size}.`);
if (outputRows.length < 1_500) throw new Error(`Expected at least 1,500 player-team records but collected ${outputRows.length}.`);

const order = new Map(TEAM_ORDER.map((team, index) => [team, index]));
outputRows.sort((left, right) =>
  (order.get(left.team) ?? 999) - (order.get(right.team) ?? 999) ||
  left.pos.localeCompare(right.pos) ||
  left.player_name.localeCompare(right.player_name),
);

const outputCsv = [
  OUTPUT_FIELDS.join(','),
  ...outputRows.map((row) => OUTPUT_FIELDS.map((field) => csvValue(row[field])).join(',')),
].join('\n') + '\n';

await mkdir(outputDir, { recursive: true });
await writeFile(temporaryPath, outputCsv);
await rename(temporaryPath, outputPath);
console.log(`Collected ${outputRows.length.toLocaleString()} ${season} player-team records across ${teams.size} teams.`);
