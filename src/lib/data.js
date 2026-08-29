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

export function normalizePlayerName(name) {
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

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
