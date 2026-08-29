export const TEAMS = {
  crd: { name: 'Arizona Cardinals', short: 'ARI', primary: '#97233f', secondary: '#ffb612' },
  atl: { name: 'Atlanta Falcons', short: 'ATL', primary: '#a71930', secondary: '#000000' },
  rav: { name: 'Baltimore Ravens', short: 'BAL', primary: '#241773', secondary: '#9e7c0c' },
  buf: { name: 'Buffalo Bills', short: 'BUF', primary: '#00338d', secondary: '#c60c30' },
  car: { name: 'Carolina Panthers', short: 'CAR', primary: '#0085ca', secondary: '#101820' },
  chi: { name: 'Chicago Bears', short: 'CHI', primary: '#0b162a', secondary: '#c83803' },
  cin: { name: 'Cincinnati Bengals', short: 'CIN', primary: '#fb4f14', secondary: '#000000' },
  cle: { name: 'Cleveland Browns', short: 'CLE', primary: '#311d00', secondary: '#ff3c00' },
  dal: { name: 'Dallas Cowboys', short: 'DAL', primary: '#041e42', secondary: '#869397' },
  den: { name: 'Denver Broncos', short: 'DEN', primary: '#002244', secondary: '#fb4f14' },
  det: { name: 'Detroit Lions', short: 'DET', primary: '#0076b6', secondary: '#b0b7bc' },
  gnb: { name: 'Green Bay Packers', short: 'GB', primary: '#203731', secondary: '#ffb612' },
  htx: { name: 'Houston Texans', short: 'HOU', primary: '#03202f', secondary: '#a71930' },
  clt: { name: 'Indianapolis Colts', short: 'IND', primary: '#002c5f', secondary: '#a2aaad' },
  jax: { name: 'Jacksonville Jaguars', short: 'JAX', primary: '#006778', secondary: '#d7a22a' },
  kan: { name: 'Kansas City Chiefs', short: 'KC', primary: '#e31837', secondary: '#ffb81c' },
  rai: { name: 'Las Vegas Raiders', short: 'LV', primary: '#000000', secondary: '#a5acaf' },
  sdg: { name: 'Los Angeles Chargers', short: 'LAC', primary: '#0080c6', secondary: '#ffc20e' },
  ram: { name: 'Los Angeles Rams', short: 'LAR', primary: '#003594', secondary: '#ffa300' },
  mia: { name: 'Miami Dolphins', short: 'MIA', primary: '#008e97', secondary: '#fc4c02' },
  min: { name: 'Minnesota Vikings', short: 'MIN', primary: '#4f2683', secondary: '#ffc62f' },
  nwe: { name: 'New England Patriots', short: 'NE', primary: '#002244', secondary: '#c60c30' },
  nor: { name: 'New Orleans Saints', short: 'NO', primary: '#8a7237', secondary: '#101820' },
  nyg: { name: 'New York Giants', short: 'NYG', primary: '#0b2265', secondary: '#a71930' },
  nyj: { name: 'New York Jets', short: 'NYJ', primary: '#125740', secondary: '#000000' },
  phi: { name: 'Philadelphia Eagles', short: 'PHI', primary: '#004c54', secondary: '#a5acaf' },
  pit: { name: 'Pittsburgh Steelers', short: 'PIT', primary: '#101820', secondary: '#ffb612' },
  sfo: { name: 'San Francisco 49ers', short: 'SF', primary: '#aa0000', secondary: '#b3995d' },
  sea: { name: 'Seattle Seahawks', short: 'SEA', primary: '#002244', secondary: '#69be28' },
  tam: { name: 'Tampa Bay Buccaneers', short: 'TB', primary: '#d50a0a', secondary: '#ff7900' },
  oti: { name: 'Tennessee Titans', short: 'TEN', primary: '#0c2340', secondary: '#4b92db' },
  was: { name: 'Washington Commanders', short: 'WAS', primary: '#5a1414', secondary: '#ffb612' },
};

export const teamEntries = Object.entries(TEAMS).sort(([, left], [, right]) =>
  left.name.localeCompare(right.name),
);

export function teamFor(code) {
  return TEAMS[code] ?? { name: code?.toUpperCase() || 'Unknown team', short: code?.toUpperCase() || '—', primary: '#334155', secondary: '#94a3b8' };
}
