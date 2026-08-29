import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const OURLADS_INDEX = 'https://secure.ourlads.com/ncaa-football-depth-charts/default.aspx';
const OURLADS_ROOT = 'https://secure.ourlads.com/ncaa-football-depth-charts/';
const ON3_API = 'https://api.on3.com/public/rdb/v1';
const FOOTBALL_SPORT_KEY = 1;
const INCLUDED_CONFERENCES = new Map([
  ['ACC', 'ACC'],
  ['Big 10', 'Big Ten'],
  ['Big 12', 'Big 12'],
  ['SEC', 'SEC'],
  ['Independents', 'Independent'],
]);
const ON3_NAME_ALIASES = {
  'North Carolina State': 'NC State',
  'Central Florida': 'UCF',
  Mississippi: 'Ole Miss',
};
const MANUAL_ON3_KEYS = { Arizona: 3376 };

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const year = Number.parseInt(process.argv[2] ?? new Date().getFullYear(), 10);
if (!Number.isInteger(year) || year < 2020 || year > 2035) {
  throw new Error('Pass a college season between 2020 and 2035, for example: npm run collect:college-data -- 2026');
}

function cleanText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeName(name) {
  let normalized = cleanText(name);
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

function displayName(name) {
  const value = cleanText(name);
  if (!value.includes(',')) return value;
  const [lastName, ...firstName] = value.split(',');
  return `${firstName.join(' ').trim()} ${lastName.trim()}`;
}

function cleanDepthPlayer(value) {
  const raw = cleanText(value);
  const suffix = raw.match(/\s+((?:RS\s+)?(?:FR|SO|JR|SR|GR)(?:\/TR)?)$/i);
  return {
    name: suffix ? cleanText(raw.slice(0, suffix.index)) : raw,
    classRank: suffix?.[1]?.toUpperCase() ?? '',
    isTransfer: /\/TR$/i.test(suffix?.[1] ?? ''),
  };
}

async function fetchText(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (compatible; Snap-Atlas/2.0; college-data-collector)',
    },
  });
  if (!response.ok) throw new Error(`${label} failed with status ${response.status}.`);
  return response.text();
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; Snap-Atlas/2.0; college-data-collector)',
    },
  });
  if (!response.ok) throw new Error(`${label} failed with status ${response.status}.`);
  return response.json();
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

function parseOurladsIndex(html) {
  const $ = load(html);
  const title = cleanText($('h1').first().text() || $('title').text());
  const pageYear = Number.parseInt(title.match(/\b(20\d{2})\b/)?.[1] ?? '', 10);
  if (pageYear !== year) throw new Error(`Ourlads is publishing ${pageYear || 'an unknown season'}, not ${year}.`);

  const teams = [];
  $('h3').each((_, heading) => {
    const sourceConference = cleanText($(heading).text());
    const conference = INCLUDED_CONFERENCES.get(sourceConference);
    if (!conference) return;

    let pendingName = '';
    let sibling = $(heading).next();
    while (sibling.length && sibling[0].name !== 'h3') {
      if (sibling.hasClass('nfl-dc-mm-team')) pendingName = cleanText(sibling.text());
      if (sibling.hasClass('ncaa-dc-mm-team-links') && pendingName) {
        const link = sibling.find('a[href*="depth-chart.aspx"]').first().attr('href');
        if (link && (sourceConference !== 'Independents' || pendingName === 'Notre Dame')) {
          const url = new URL(link, OURLADS_ROOT);
          teams.push({
            key: url.searchParams.get('s'),
            name: pendingName,
            conference,
            depthChartUrl: url.href,
          });
        }
        pendingName = '';
      }
      sibling = sibling.next();
    }
  });

  if (teams.length !== 68) throw new Error(`Expected 68 Power Four + Notre Dame teams but found ${teams.length}.`);
  return teams;
}

function parseDepthChart(html, teamName) {
  const $ = load(html);
  const tables = $('table').toArray();
  if (tables.length < 2) throw new Error(`${teamName} did not contain offense and defense tables.`);

  const parseUnit = (table) => {
    const unit = {};
    $(table).find('tr').slice(1).each((_, row) => {
      const cells = $(row).find('th, td').map((__, cell) => cleanText($(cell).text())).get();
      const position = cells[0];
      if (!position || position === 'INJ') return;
      const players = [];
      for (let index = 1; index < cells.length - 1; index += 2) {
        const number = cells[index];
        const parsed = cleanDepthPlayer(cells[index + 1]);
        if (!parsed.name) continue;
        players.push({
          num: number,
          name: displayName(parsed.name),
          normalizedName: normalizeName(parsed.name),
          classRank: parsed.classRank,
          isTransfer: parsed.isTransfer,
          playerId: null,
        });
      }
      if (players.length) unit[position] = players;
    });
    return unit;
  };

  const depthCharts = { offense: parseUnit(tables[0]), defense: parseUnit(tables[1]) };
  if (Object.keys(depthCharts.offense).length < 8 || Object.keys(depthCharts.defense).length < 8) {
    throw new Error(`${teamName} produced an incomplete depth chart.`);
  }
  return depthCharts;
}

function compactRating(rating) {
  if (!rating || (!Number.isFinite(rating.rating) && !Number.isFinite(rating.stars))) return null;
  return {
    rating: rating.rating ?? null,
    stars: rating.stars ?? null,
    nationalRank: rating.nationalRank ?? null,
    positionRank: rating.positionRank ?? null,
    stateRank: rating.stateRank ?? null,
    position: rating.positionAbbr ?? null,
    state: rating.stateAbbr ?? null,
    year: rating.year ?? year,
    industryRating: rating.consensusRating ?? null,
    industryStars: rating.consensusStars ?? null,
    industryNationalRank: rating.consensusNationalRank ?? null,
    industryPositionRank: rating.consensusPositionRank ?? null,
    industryStateRank: rating.consensusStateRank ?? null,
  };
}

function compactRosterPlayer(item) {
  const player = item.player ?? {};
  return {
    id: String(player.key ?? item.psoKey),
    name: cleanText(player.fullName || `${player.firstName ?? ''} ${player.lastName ?? ''}`),
    normalizedName: normalizeName(player.fullName || `${player.firstName ?? ''} ${player.lastName ?? ''}`),
    slug: player.slug ?? null,
    jerseyNumber: player.jerseyNumber ?? null,
    position: player.position?.abbr ?? player.position?.name ?? null,
    classRank: player.classRank ?? null,
    height: player.height ?? null,
    weight: player.weight ?? null,
    hometown: cleanText(player.hometown?.name ?? player.homeTownName ?? ''),
    highSchool: cleanText(player.highSchoolName ?? player.highSchool?.name ?? ''),
    recruiting: compactRating(item.rating),
    transfer: null,
  };
}

function compactTransfer(item, organizationKey) {
  const committed = item.commitStatus?.committedOrganization ?? item.interestStatus?.committedOrganization;
  if (Number(committed?.key) !== Number(organizationKey)) return null;
  const rating = compactRating(item.transferRating ?? item.rosterRating);
  if (!rating) return null;
  return {
    ...rating,
    fromTeam: cleanText(item.lastTeam?.name ?? item.lastTeam?.fullName ?? ''),
    toTeam: cleanText(committed?.name ?? committed?.fullName ?? ''),
    portalYear: year,
  };
}

function matchPlayers(depthCharts, players) {
  const exact = new Map(players.map((player) => [player.normalizedName, player]));
  const abbreviated = new Map();
  players.forEach((player) => {
    const parts = player.normalizedName.split(' ');
    const key = `${parts[0]?.[0] ?? ''}|${parts.at(-1) ?? ''}`;
    if (!abbreviated.has(key)) abbreviated.set(key, []);
    abbreviated.get(key).push(player);
  });

  let slots = 0;
  let matched = 0;
  for (const unit of ['offense', 'defense']) {
    Object.values(depthCharts[unit]).forEach((positionPlayers) => {
      positionPlayers.forEach((depthPlayer) => {
        slots += 1;
        let rosterPlayer = exact.get(depthPlayer.normalizedName);
        if (!rosterPlayer) {
          const parts = depthPlayer.normalizedName.split(' ');
          const choices = abbreviated.get(`${parts[0]?.[0] ?? ''}|${parts.at(-1) ?? ''}`) ?? [];
          if (choices.length === 1) [rosterPlayer] = choices;
        }
        if (rosterPlayer) {
          depthPlayer.playerId = rosterPlayer.id;
          matched += 1;
        }
      });
    });
  }
  return { slots, matched };
}

const indexHtml = await fetchText(OURLADS_INDEX, 'Ourlads college index');
const sourceTeams = parseOurladsIndex(indexHtml);
const on3TeamResponse = await fetchJson(`${ON3_API}/filters/teams?sportKey=${FOOTBALL_SPORT_KEY}&year=${year}`, 'On3 team list');
const on3Teams = Array.isArray(on3TeamResponse) ? on3TeamResponse : on3TeamResponse.list ?? on3TeamResponse.options ?? [];
const on3ByName = new Map(on3Teams.map((team) => [cleanText(team.orgName ?? team.name), team]));

let completed = 0;
const teams = await mapLimit(sourceTeams, 4, async (sourceTeam) => {
  const on3Name = ON3_NAME_ALIASES[sourceTeam.name] ?? sourceTeam.name;
  const on3Team = on3ByName.get(on3Name) ?? { orgKey: MANUAL_ON3_KEYS[sourceTeam.name] };
  const organizationKey = on3Team?.orgKey ?? on3Team?.key;
  if (!organizationKey) throw new Error(`Could not match ${sourceTeam.name} to an On3 organization.`);

  const [depthHtml, rosterResponse] = await Promise.all([
    fetchText(sourceTeam.depthChartUrl, `${sourceTeam.name} Ourlads depth chart`),
    fetchJson(`${ON3_API}/organizations/${organizationKey}/roster?sportKey=${FOOTBALL_SPORT_KEY}&year=${year}`, `${sourceTeam.name} On3 roster`),
  ]);
  const depthCharts = parseDepthChart(depthHtml, sourceTeam.name);
  const players = (rosterResponse.list ?? []).map(compactRosterPlayer).filter((player) => player.id && player.name);
  if (players.length < 40) throw new Error(`${sourceTeam.name} returned only ${players.length} On3 roster players.`);

  const depthTransfers = new Set(
    ['offense', 'defense'].flatMap((unit) => Object.values(depthCharts[unit]).flat())
      .filter((player) => player.isTransfer)
      .map((player) => player.normalizedName),
  );
  if (depthTransfers.size) {
    const firstPage = await fetchJson(
      `${ON3_API}/transfers/latest?orgKey=${organizationKey}&sportKey=${FOOTBALL_SPORT_KEY}&year=${year}&page=1`,
      `${sourceTeam.name} On3 transfers`,
    );
    const transferItems = [...(firstPage.list ?? [])];
    const found = new Set(transferItems.map((item) => normalizeName(item.name)).filter((name) => depthTransfers.has(name)));
    const pageCount = Math.min(Number(firstPage.pagination?.pageCount ?? 1), 5);
    if (found.size < depthTransfers.size && pageCount > 1) {
      const remaining = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => fetchJson(
        `${ON3_API}/transfers/latest?orgKey=${organizationKey}&sportKey=${FOOTBALL_SPORT_KEY}&year=${year}&page=${index + 2}`,
        `${sourceTeam.name} On3 transfers page ${index + 2}`,
      )));
      remaining.forEach((page) => transferItems.push(...(page.list ?? [])));
    }

    const rosterByName = new Map(players.map((player) => [player.normalizedName, player]));
    transferItems.forEach((item) => {
      const player = rosterByName.get(normalizeName(item.name));
      const transfer = compactTransfer(item, organizationKey);
      if (player && transfer) player.transfer = transfer;
    });
  }

  const match = matchPlayers(depthCharts, players);
  const org = rosterResponse.relatedModel?.orgResponse ?? rosterResponse.relatedModel?.org ?? {};
  completed += 1;
  if (completed % 5 === 0 || completed === sourceTeams.length) {
    console.log(`Collected ${completed}/${sourceTeams.length} college teams...`);
  }

  return {
    key: sourceTeam.key,
    name: sourceTeam.name,
    mascot: cleanText(org.mascot ?? on3Team.mascot ?? ''),
    abbreviation: cleanText(org.abbreviation ?? on3Team.abbreviation ?? sourceTeam.key.slice(0, 4)).toUpperCase(),
    conference: sourceTeam.conference,
    primary: org.primaryColor ?? on3Team.primaryColor ?? '#1d4f7a',
    secondary: '#f2b84b',
    on3OrganizationKey: Number(organizationKey),
    players,
    depthCharts,
    match,
  };
});

teams.sort((left, right) => left.name.localeCompare(right.name));
const depthSlotCount = teams.reduce((sum, team) => sum + team.match.slots, 0);
const matchedDepthSlots = teams.reduce((sum, team) => sum + team.match.matched, 0);
const rosterPlayerCount = teams.reduce((sum, team) => sum + team.players.length, 0);
const recruitingRatedCount = teams.reduce((sum, team) => sum + team.players.filter((player) => player.recruiting).length, 0);
const transferRatedCount = teams.reduce((sum, team) => sum + team.players.filter((player) => player.transfer).length, 0);
if (matchedDepthSlots / depthSlotCount < 0.65) {
  throw new Error(`Only ${matchedDepthSlots}/${depthSlotCount} depth-chart slots matched On3 roster players.`);
}

const output = {
  metadata: {
    generatedAt: new Date().toISOString(),
    season: year,
    teamCount: teams.length,
    conferenceCount: new Set(teams.map((team) => team.conference)).size,
    rosterPlayerCount,
    depthSlotCount,
    matchedDepthSlots,
    recruitingRatedCount,
    transferRatedCount,
    sources: {
      depthCharts: 'Ourlads',
      recruiting: 'On3',
      transfers: 'On3 Transfer Portal',
    },
  },
  conferences: [...new Set(teams.map((team) => team.conference))],
  teams,
};

const outputDir = path.join(rootDir, 'data', 'source', 'college');
const outputPath = path.join(outputDir, `${year}.json`);
const temporaryPath = `${outputPath}.tmp`;
await mkdir(outputDir, { recursive: true });
await writeFile(temporaryPath, `${JSON.stringify(output, null, 2)}\n`);
await rename(temporaryPath, outputPath);

console.log(
  `Saved ${teams.length} teams, ${rosterPlayerCount.toLocaleString()} roster players, ` +
  `${matchedDepthSlots.toLocaleString()}/${depthSlotCount.toLocaleString()} matched depth slots, and ` +
  `${transferRatedCount.toLocaleString()} matched transfer ratings for ${year}.`,
);
