export async function loadCollegeData(signal) {
  const response = await fetch('/data/college-data.json', { signal });
  if (!response.ok) throw new Error(`College data request failed with status ${response.status}.`);
  return response.json();
}

export function ratingLabel(rating) {
  if (!rating) return 'Unrated by On3';
  const stars = rating.stars ? `${rating.stars}-star` : 'Rated';
  const score = Number.isFinite(rating.rating) ? ` · ${Number(rating.rating).toFixed(1)}` : '';
  return `${stars}${score}`;
}

export function rankLabel(rank, suffix) {
  return Number.isFinite(rank) ? `#${rank.toLocaleString()} ${suffix}` : '—';
}
