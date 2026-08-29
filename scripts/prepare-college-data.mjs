import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const sourceDir = path.join(rootDir, 'data', 'source', 'college');
const outputDir = path.join(rootDir, 'public', 'data');
const outputPath = path.join(outputDir, 'college-data.json');

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

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(data));
console.log(`Prepared ${data.metadata.season} college data for ${data.teams.length} teams.`);
