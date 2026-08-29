import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const SOURCE_URL = 'https://www.ourlads.com/nfldepthcharts/depthcharts.aspx';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceDir = path.join(rootDir, 'data', 'source');
const depthChartPath = path.join(sourceDir, 'depth-charts.json');
const configPath = path.join(sourceDir, 'config.json');

const TEAM_CODES = {
  ARZ: 'crd', ATL: 'atl', BAL: 'rav', BUF: 'buf', CAR: 'car', CHI: 'chi', CIN: 'cin', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det', GB: 'gnb', HOU: 'htx', IND: 'clt', JAX: 'jax', KC: 'kan',
  LV: 'rai', LAC: 'sdg', LAR: 'ram', MIA: 'mia', MIN: 'min', NE: 'nwe', NO: 'nor', NYG: 'nyg',
  NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SEA: 'sea', SF: 'sfo', TB: 'tam', TEN: 'oti', WAS: 'was',
};

function cleanText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanPlayerName(value) {
  return cleanText(value)
    .replace(/\s+(?:\d{2}\/\d|[A-Z]{1,3}\/[A-Za-z]+|[A-Z]{1,3}\d{2}\*?|W\/[^ ]+|P\/[^ ]+|T\/[^ ]+|CC\/[^ ]+)$/i, '')
    .replace(/\s+\*$/, '')
    .trim();
}

const response = await fetch(SOURCE_URL, {
  headers: {
    'user-agent': 'Mozilla/5.0 (compatible; NFL-Snap-Atlas/1.0; depth-chart refresh)',
    accept: 'text/html,application/xhtml+xml',
  },
});

if (!response.ok) throw new Error(`Ourlads request failed with status ${response.status}.`);
const html = await response.text();
const $ = load(html);
const pageTitle = cleanText($('h1').first().text() || $('title').text());
const seasonMatch = pageTitle.match(/\b(20\d{2})\b/);
if (!seasonMatch) throw new Error(`Could not determine the depth-chart season from "${pageTitle}".`);
const depthChartSeason = Number(seasonMatch[1]);

const depthCharts = {};
let currentUnit = null;

$('tr').each((_, rowElement) => {
  const cells = $(rowElement).find('th, td').map((__, cell) => cleanText($(cell).text())).get();
  if (cells.length === 0) return;
  const rowText = cells.join(' ');

  if (/Offense\s*-/i.test(rowText)) {
    currentUnit = 'offense';
    return;
  }
  if (/Defense\s*-/i.test(rowText)) {
    currentUnit = 'defense';
    return;
  }
  if (/Special Teams\s*-|Practice Squad|Reserves\s*-/i.test(rowText)) {
    currentUnit = null;
    return;
  }

  const team = TEAM_CODES[cells[0]];
  const position = cells[1];
  if (!team || !currentUnit || !position) return;

  depthCharts[team] ??= { offense: {}, defense: {} };
  depthCharts[team][currentUnit][position] ??= [];

  for (let index = 2; index < cells.length - 1; index += 2) {
    const number = cells[index];
    const name = cleanPlayerName(cells[index + 1]);
    if (!name) continue;
    const key = `${number}|${name.toLowerCase()}`;
    const exists = depthCharts[team][currentUnit][position].some(
      (player) => `${player.num}|${player.name.toLowerCase()}` === key,
    );
    if (!exists) depthCharts[team][currentUnit][position].push({ num: number, name });
  }
});

const teamCount = Object.keys(depthCharts).length;
if (teamCount !== 32) throw new Error(`Expected 32 teams from Ourlads but parsed ${teamCount}.`);

for (const [team, chart] of Object.entries(depthCharts)) {
  const offensePositions = Object.keys(chart.offense).length;
  const defensePositions = Object.keys(chart.defense).length;
  if (offensePositions < 10 || defensePositions < 10) {
    throw new Error(`Parsed an incomplete ${team} chart: ${offensePositions} offense, ${defensePositions} defense positions.`);
  }
}

const config = JSON.parse(await readFile(configPath, 'utf8'));
config.depthChartSeason = depthChartSeason;

await Promise.all([
  writeFile(depthChartPath, `${JSON.stringify(depthCharts, null, 2)}\n`),
  writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`),
]);

const playerCount = Object.values(depthCharts).reduce(
  (teamTotal, chart) => teamTotal + ['offense', 'defense'].reduce(
    (unitTotal, unit) => unitTotal + Object.values(chart[unit]).reduce((total, players) => total + players.length, 0),
    0,
  ),
  0,
);

console.log(`Refreshed ${depthChartSeason} depth charts for ${teamCount} teams and ${playerCount.toLocaleString()} player slots.`);
