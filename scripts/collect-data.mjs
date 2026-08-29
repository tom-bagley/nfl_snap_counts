import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const forwardedArguments = process.argv.slice(2);

if (!forwardedArguments.includes('--season') && !/^20\d{2}$/.test(forwardedArguments[0] ?? '')) {
  console.error('Usage: npm run collect:data -- 2025');
  process.exit(1);
}

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { cwd: rootDir, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [
  path.join('scripts', 'collect-snap-counts.mjs'),
  ...forwardedArguments,
]);
run(process.execPath, [path.join('scripts', 'refresh-depth-charts.mjs')]);
run(process.execPath, [path.join('scripts', 'prepare-data.mjs')]);
