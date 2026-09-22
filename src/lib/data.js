export async function loadNflData(signal) {
  const response = await fetch('/data/nfl-data.json', { signal });
  if (!response.ok) {
    throw new Error(`Data request failed with status ${response.status}.`);
  }

  const data = await response.json();
  if (!data?.metadata || !Array.isArray(data.snapCounts) || !data.depthCharts) {
    throw new Error('The generated NFL data file has an invalid shape.');
  }
  return data;
}

export function snapTotal(row, category) {
  return row?.[category] ?? 0;
}

export function formatPlayerName(name) {
  if (!name?.includes(',')) return name;
  const [lastName, ...firstName] = name.split(',');
  return `${firstName.join(' ').trim()} ${lastName.trim()}`;
}

// Ourlads often uses a nickname where the snap-count source uses a given name.
// Keep these full-name aliases explicit so players sharing a surname cannot be mixed.
const NFL_NAME_ALIASES = {
  'bam knight': 'zonovan knight',
  'vega ioane': 'olaivavega ioane',
  'matt hibner': 'matthew hibner',
  'joshua palmer': 'josh palmer',
  'greg rousseau': 'gregory rousseau',
  'mike danna': 'michael danna',
  'dee alford': 'deaundre alford',
  'mike jackson': 'michael jackson',
  'cam lewis': 'cameron lewis',
  'tj slaton': 'tedarrell slaton',
  'dax hill': 'daxton hill',
  'mike hall': 'michael hall',
  'que robinson': 'quandarrius robinson',
  'pat surtain': 'patrick surtain',
  'drew ogletree': 'andrew ogletree',
  'jaylahn tuimoloau': 'jt tuimoloau',
  'cam bynum': 'camryn bynum',
  'chris roland wallace': 'christian roland wallace',
  'nate landman': 'nathan landman',
  'kam curl': 'kamren curl',
  'dj glaze': 'delmar glaze',
  'rob beal': 'robert beal',
  'josh uche': 'joshua uche',
  'juju brents': 'julius brents',
  'joshua metellus': 'josh metellus',
  'mike onwenu': 'michael onwenu',
  'mike reid': 'michael reid',
  'dru phillips': 'andru phillips',
  'kiko mauigoa': 'francisco mauigoa',
  'hollywood brown': 'marquise brown',
  'olu oluwatimi': 'olusegun oluwatimi',
  'kenny gainwell': 'kenneth gainwell',
  'cor dale flott': 'cordale flott',
  'sam cosmi': 'samuel cosmi',
};

export function normalizePlayerName(name) {
  let normalized = String(name ?? '').trim();
  if (normalized.includes(',')) {
    const [lastName, ...firstName] = normalized.split(',');
    normalized = `${firstName.join(' ').trim()} ${lastName.trim()}`;
  }

  const key = normalized
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/gi, '')
    .replace(/\b(?:[a-z]\.\s*)+[a-z]\.?(?![a-z])/gi, (initials) => initials.replace(/[^a-z]/gi, ''))
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return NFL_NAME_ALIASES[key] ?? key;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
