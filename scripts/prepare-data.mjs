import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceDir = path.join(rootDir, 'data', 'source');
const snapCountsDir = path.join(sourceDir, 'snap-counts');
const outputDir = path.join(rootDir, 'public', 'data');
const depthChartPath = path.join(sourceDir, 'depth-charts.json');
const configPath = path.join(sourceDir, 'config.json');
const appDataPath = path.join(outputDir, 'nfl-data.json');

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
  if (quoted) throw new Error('A snap-count CSV contains an unterminated quoted value.');
  return rows;
}

function normalizeName(name) {
  let normalized = String(name ?? '').trim();
  if (normalized.includes(',')) {
    const [lastName, ...firstName] = normalized.split(',');
    normalized = `${firstName.join(' ').trim()} ${lastName.trim()}`;
  }
  return normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function numberValue(value, field, sourceLabel, rowNumber) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} in ${sourceLabel}, row ${rowNumber}: "${value}"`);
  }
  return parsed;
}

function buildSeasonRows(csvText, season, sourceLabel) {
  const [headers, ...values] = parseCsv(csvText);
  const required = ['pos', 'player_id', 'player_name', 'team', 'offense', 'defense', 'special_teams'];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length > 0) throw new Error(`${sourceLabel} is missing required columns: ${missing.join(', ')}`);

  const records = new Map();
  let duplicatesCollapsed = 0;

  values.forEach((cells, index) => {
    const source = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex] ?? '']));
    const playerId = source.player_id.trim();
    const team = source.team.toLowerCase().trim();
    const position = source.pos.trim();
    if (!playerId || !source.player_name || !team || !position) {
      throw new Error(`${sourceLabel}, row ${index + 2} is missing a player ID, name, team, or position.`);
    }

    const recordKey = [playerId, season, team, position].join('|');
    const record = {
      id: recordKey,
      playerId,
      playerKey: playerId,
      playerName: source.player_name,
      normalizedName: normalizeName(source.player_name),
      position,
      season,
      team,
      offense: numberValue(source.offense, 'offense', sourceLabel, index + 2),
      defense: numberValue(source.defense, 'defense', sourceLabel, index + 2),
      specialTeams: numberValue(source.special_teams, 'special_teams', sourceLabel, index + 2),
    };

    const existing = records.get(recordKey);
    if (existing) {
      const sameFacts = ['offense', 'defense', 'specialTeams'].every((field) => existing[field] === record[field]);
      if (!sameFacts) throw new Error(`Conflicting duplicate in ${sourceLabel}, row ${index + 2}: ${recordKey}`);
      duplicatesCollapsed += 1;
      return;
    }
    records.set(recordKey, record);
  });

  return { rows: [...records.values()], duplicatesCollapsed, sourceRows: values.length };
}

function validateDepthCharts(depthCharts) {
  const teams = Object.entries(depthCharts);
  if (teams.length !== 32) throw new Error(`Expected 32 depth-chart teams but found ${teams.length}.`);
  for (const [team, chart] of teams) {
    for (const unit of ['offense', 'defense']) {
      if (!chart[unit] || typeof chart[unit] !== 'object') throw new Error(`${team} is missing its ${unit} chart.`);
      for (const [position, players] of Object.entries(chart[unit])) {
        if (!Array.isArray(players) || players.length === 0) throw new Error(`${team}/${unit}/${position} has no players.`);
        if (players.some((player) => !player.name)) throw new Error(`${team}/${unit}/${position} has a player without a name.`);
      }
    }
  }
}

const seasonFileNames = (await readdir(snapCountsDir))
  .filter((fileName) => /^20\d{2}\.csv$/.test(fileName))
  .sort();
if (seasonFileNames.length === 0) throw new Error('No season CSV files were found in data/source/snap-counts.');

const seasonSources = await Promise.all(seasonFileNames.map(async (fileName) => {
  const filePath = path.join(snapCountsDir, fileName);
  const [text, fileStat] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)]);
  return { fileName, text, fileStat, season: Number.parseInt(path.basename(fileName, '.csv'), 10) };
}));

const [depthText, configText, depthStat] = await Promise.all([
  readFile(depthChartPath, 'utf8'),
  readFile(configPath, 'utf8'),
  stat(depthChartPath),
]);

const snapCounts = [];
let duplicatesCollapsed = 0;
let sourceRowCount = 0;
for (const source of seasonSources) {
  const built = buildSeasonRows(source.text, source.season, source.fileName);
  snapCounts.push(...built.rows);
  duplicatesCollapsed += built.duplicatesCollapsed;
  sourceRowCount += built.sourceRows;
}

const depthCharts = JSON.parse(depthText);
const config = JSON.parse(configText);
validateDepthCharts(depthCharts);
if (!Number.isInteger(config.depthChartSeason)) throw new Error('depthChartSeason must be an integer.');

const snapSeasons = [...new Set(snapCounts.map((row) => row.season))].sort((a, b) => b - a);
const seasons = [...new Set([config.depthChartSeason, ...snapSeasons])].sort((a, b) => b - a);
const teams = [...new Set(snapCounts.map((row) => row.team))].sort();
const players = new Set(snapCounts.map((row) => row.playerId));
const latestSeason = snapSeasons[0];
const latestSnapMtime = new Date(Math.max(...seasonSources.map((source) => source.fileStat.mtimeMs)));

const output = {
  metadata: {
    generatedAt: new Date().toISOString(),
    snapCountsUpdatedAt: latestSnapMtime.toISOString(),
    depthChartsUpdatedAt: depthStat.mtime.toISOString(),
    latestSeason,
    depthChartSeason: config.depthChartSeason,
    seasons,
    seasonFileCount: seasonFileNames.length,
    teamCount: teams.length,
    playerCount: players.size,
    rowCount: snapCounts.length,
    sourceRowCount,
    duplicatesCollapsed,
    depthChartTeamCount: Object.keys(depthCharts).length,
    sources: { snapCounts: config.snapCountsSource, depthCharts: config.depthChartsSource },
  },
  snapCounts,
  depthCharts,
};

await mkdir(outputDir, { recursive: true });
await writeFile(appDataPath, JSON.stringify(output));
console.log(
  `Prepared ${snapCounts.length.toLocaleString()} rows from ${seasonFileNames.length} seasons, ` +
  `${players.size.toLocaleString()} players, ${teams.length} teams, and ${Object.keys(depthCharts).length} depth charts.`,
);
