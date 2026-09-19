export const INCLUDED_CONFERENCES = new Map([
  ['AAC', 'American'],
  ['ACC', 'ACC'],
  ['Big 10', 'Big Ten'],
  ['Big 12', 'Big 12'],
  ['Conference USA', 'Conference USA'],
  ['Independents', 'Independent'],
  ['MAC', 'MAC'],
  ['Mountain West', 'Mountain West'],
  ['PAC-12', 'Pac-12'],
  ['SEC', 'SEC'],
  ['Sun Belt', 'Sun Belt'],
]);

// Full 2026 FBS coverage, including the two transitioning programs.
export const EXPECTED_TEAM_COUNT = 138;

export function validateCollegeCoverage(teams) {
  if (!Array.isArray(teams) || teams.length !== EXPECTED_TEAM_COUNT) {
    throw new Error(`Expected ${EXPECTED_TEAM_COUNT} FBS teams but found ${teams?.length ?? 0}.`);
  }
  const keys = new Set();
  const conferences = new Set(INCLUDED_CONFERENCES.values());
  const foundConferences = new Set();
  for (const team of teams) {
    if (!team.key || keys.has(team.key)) throw new Error(`Missing or duplicate college team key: ${team.key}`);
    if (!conferences.has(team.conference)) throw new Error(`Unknown conference for ${team.name}: ${team.conference}`);
    keys.add(team.key);
    foundConferences.add(team.conference);
  }
  for (const conference of conferences) {
    if (!foundConferences.has(conference)) throw new Error(`Missing FBS conference: ${conference}`);
  }
}
