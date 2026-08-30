import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceDir = path.join(rootDir, 'data', 'source', 'college');
const pffSourceDir = path.join(rootDir, 'data', 'source', 'pff-big-board');
const outputDir = path.join(rootDir, 'public', 'data');
const outputPath = path.join(outputDir, 'college-data.json');

const PFF_SCHOOL_ALIASES = {
  'Miami (FL)': 'Miami',
};

const PFF_PLAYER_ALIASES = {
  'mississippi|will echoles': 'william echoles',
};

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1')
    .toLowerCase();
}

const sourceFiles = (await readdir(sourceDir)).filter((file) => /^20\d{2}\.json$/.test(file)).sort().reverse();
if (!sourceFiles.length) throw new Error('No college source file was found in data/source/college.');

const data = JSON.parse(await readFile(path.join(sourceDir, sourceFiles[0]), 'utf8'));
if (data.metadata?.teamCount !== 68 || data.teams?.length !== 68) {
  throw new Error(`Expected 68 college teams but found ${data.teams?.length ?? 0}.`);
}
if (!Number.isInteger(data.metadata?.season)) throw new Error('College data is missing a valid season.');
for (const team of data.teams) {
  if (!team.key || !team.name || !team.conference) throw new Error('A college team is missing required metadata.');
  if (!team.players?.length) throw new Error(`${team.name} has no roster players.`);
  for (const unit of ['offense', 'defense']) {
    if (Object.keys(team.depthCharts?.[unit] ?? {}).length < 8) throw new Error(`${team.name} has an incomplete ${unit} chart.`);
  }
}

const draftYear = data.metadata.season + 1;
let pffMatchedCount = 0;
try {
  const pffBoard = JSON.parse(await readFile(path.join(pffSourceDir, `${draftYear}.json`), 'utf8'));
  if (pffBoard.metadata?.draftYear !== draftYear) throw new Error(`PFF board year does not match ${draftYear}.`);
  if (pffBoard.metadata?.prospectCount !== pffBoard.players?.length) throw new Error('PFF board prospect count is inconsistent.');
  const ranks = new Set();
  const teamsByName = new Map(data.teams.map((team) => [team.name, team]));
  for (const prospect of pffBoard.players) {
    if (!Number.isInteger(prospect.rank) || prospect.rank < 1 || ranks.has(prospect.rank)) {
      throw new Error(`PFF board contains an invalid or duplicate rank: ${prospect.rank}.`);
    }
    ranks.add(prospect.rank);
    const school = PFF_SCHOOL_ALIASES[prospect.school] ?? prospect.school;
    const team = teamsByName.get(school);
    if (!team) continue;
    const sourceKey = `${school.toLowerCase()}|${normalizeName(prospect.name)}`;
    const targetName = PFF_PLAYER_ALIASES[sourceKey] ?? normalizeName(prospect.name);
    const matches = team.players.filter((player) => normalizeName(player.name) === targetName);
    if (matches.length !== 1) continue;
    matches[0].pffBigBoard = {
      rank: prospect.rank,
      draftYear,
      position: prospect.position,
      school: prospect.school,
      updatedAt: pffBoard.metadata.updatedAt,
      sourceUrl: pffBoard.metadata.sourceUrl,
    };
    pffMatchedCount += 1;
  }
  data.metadata.pffBigBoardDraftYear = draftYear;
  data.metadata.pffBigBoardProspectCount = pffBoard.players.length;
  data.metadata.pffBigBoardMatchedCount = pffMatchedCount;
  data.metadata.sources = { ...(data.metadata.sources ?? {}), pffBigBoard: 'PFF' };
} catch (caught) {
  if (caught.code !== 'ENOENT') throw caught;
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(data));
console.log(`Prepared ${data.metadata.season} college data for ${data.teams.length} teams with ${pffMatchedCount} PFF Big Board matches.`);
