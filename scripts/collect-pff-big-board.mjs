import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const draftYear = Number(process.argv[2] ?? new Date().getFullYear() + 1);
if (!Number.isInteger(draftYear) || draftYear < 2020 || draftYear > 2035) {
  throw new Error('Usage: npm run collect:pff-big-board -- 2027');
}
const sourceUrl = `https://www.pff.com/draft/big-board?season=${draftYear}`;
async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`PFF request failed with status ${response.status}: ${url}`);
  return response;
}

const page = load(await (await request(sourceUrl)).text());
const props = JSON.parse(page('.big-board').attr('data-react-props') ?? '{}');
const versions = props.versions?.find((entry) => entry.season === draftYear)?.versions ?? [];
const latest = [...versions].sort((a, b) => b.version - a.version)[0];
if (!latest) throw new Error(`PFF has no published board for ${draftYear}.`);
const apiUrl = `https://www.pff.com/api/college/big_board?season=${draftYear}&version=${latest.version}`;
const data = await (await request(apiUrl)).json();
if (Number(data.nfl_draft_season) !== draftYear) throw new Error('PFF returned the wrong draft year.');
if (!Array.isArray(data.players) || data.players.length < 50) throw new Error('PFF returned an incomplete board.');
// Only retain public draft rankings, names, positions and schools.
const players = data.players.map((player) => ({
  rank: player.pff_rank,
  name: player.name?.trim(),
  position: player.position?.trim(),
  school: player.college?.trim(),
})).sort((a, b) => a.rank - b.rank);
for (const [index, player] of players.entries()) {
  if (player.rank !== index + 1 || !player.name || !player.position || !player.school) {
    throw new Error(`PFF returned an invalid or noncontiguous ranking at ${index + 1}.`);
  }
}
const timestamp = data.last_updated_at ?? latest.last_updated_at;
if (typeof timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
  throw new Error('PFF returned an invalid update timestamp.');
}
const updatedAt = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`).toISOString();
const output = {
  metadata: {
    draftYear,
    updatedAt,
    collectedAt: new Date().toISOString(),
    prospectCount: players.length,
    source: 'PFF',
    sourceUrl,
    version: latest.version,
    versionName: latest.name,
  },
  players,
};
const outputDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'source', 'pff-big-board');
const outputPath = path.join(outputDir, `${draftYear}.json`);
await mkdir(outputDir, { recursive: true });
await writeFile(`${outputPath}.tmp`, `${JSON.stringify(output, null, 2)}\n`);
await rename(`${outputPath}.tmp`, outputPath);
console.log(`Refreshed ${players.length} PFF prospects for ${draftYear}; board updated ${updatedAt}.`);
