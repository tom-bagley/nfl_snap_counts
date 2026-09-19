import { useEffect, useMemo, useState } from 'react';
import { collegeGradeLabel } from '../lib/college';

const SCREEN_COUNT = 4;
const TEAMS_PER_SCREEN = 2;

function rankPlayers(left, right) {
  const gradeDifference = (right.currentAbility?.rating ?? -1) - (left.currentAbility?.rating ?? -1);
  if (gradeDifference) return gradeDifference;

  const pffDifference = (left.pffBigBoard?.rank ?? Number.POSITIVE_INFINITY) - (right.pffBigBoard?.rank ?? Number.POSITIVE_INFINITY);
  if (pffDifference) return pffDifference;

  const recruitingDifference = (right.recruiting?.rating ?? -1) - (left.recruiting?.rating ?? -1);
  if (recruitingDifference) return recruitingDifference;

  return left.name.localeCompare(right.name);
}

function rankingPlayersForTeam(team) {
  return team.players.map((player) => ({
    ...player,
    teamKey: team.key,
    teamName: team.name,
    teamMascot: team.mascot,
    teamAbbreviation: team.abbreviation,
    teamPrimary: team.primary,
  }));
}

function jerseyNumber(player) {
  return player.jerseyNumber === null || player.jerseyNumber === undefined || player.jerseyNumber === '' ? '—' : player.jerseyNumber;
}

export default function CollegeMultiview({ teams, conferences, teamKeys, onTeamChange, onSelectPlayer }) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const selectedKeySet = useMemo(() => new Set(teamKeys.filter(Boolean)), [teamKeys]);
  const selectedTeams = useMemo(() => teamKeys.map((key) => teams.find((team) => team.key === key)).filter(Boolean), [teamKeys, teams]);
  const rankedPlayers = useMemo(() => selectedTeams.flatMap(rankingPlayersForTeam).sort(rankPlayers), [selectedTeams]);
  const positions = useMemo(() => [...new Set(rankedPlayers.map((player) => player.position).filter(Boolean))].sort(), [rankedPlayers]);
  const visiblePlayers = useMemo(() => rankedPlayers.filter((player) => (
    player.name.toLowerCase().includes(search.trim().toLowerCase())
      && (position === 'all' || player.position === position)
      && (teamFilter === 'all' || player.teamKey === teamFilter)
  )), [position, rankedPlayers, search, teamFilter]);

  useEffect(() => {
    if (teamFilter !== 'all' && !selectedKeySet.has(teamFilter)) setTeamFilter('all');
    if (position !== 'all' && !positions.includes(position)) setPosition('all');
  }, [position, positions, selectedKeySet, teamFilter]);

  const teamOptions = (slotIndex) => conferences.map((conference) => (
    <optgroup label={conference} key={conference}>
      {teams.filter((team) => team.conference === conference).map((team) => (
        <option value={team.key} disabled={selectedKeySet.has(team.key) && teamKeys[slotIndex] !== team.key} key={team.key}>
          {team.name} {team.mascot}
        </option>
      ))}
    </optgroup>
  ));

  const screens = Array.from({ length: SCREEN_COUNT }, (_, screenIndex) => {
    const firstSlot = screenIndex * TEAMS_PER_SCREEN;
    const screenTeams = [teamKeys[firstSlot], teamKeys[firstSlot + 1]]
      .map((key) => teams.find((team) => team.key === key))
      .filter(Boolean);
    const leaders = screenTeams.flatMap(rankingPlayersForTeam).sort(rankPlayers).slice(0, 3);
    return { firstSlot, screenTeams, leaders };
  });

  return (
    <section className="multiview-section">
      <div className="section-heading multiview-heading">
        <div>
          <p className="eyebrow">Four-screen multiview</p>
          <h2>Build an eight-team talent board</h2>
          <p className="talent-board-note">Choose up to two teams per screen. Each team can appear once.</p>
        </div>
        <div className="multiview-count"><strong>{selectedTeams.length}</strong><span>of 8 teams selected</span></div>
      </div>

      <div className="multiview-grid">
        {screens.map(({ firstSlot, screenTeams, leaders }, screenIndex) => (
          <article className="multiview-screen" style={{ '--screen-primary': screenTeams[0]?.primary ?? '#26364d' }} key={screenIndex}>
            <div className="multiview-screen-heading"><span>Screen {String(screenIndex + 1).padStart(2, '0')}</span><strong>{screenTeams.length ? screenTeams.map((team) => team.abbreviation).join(' / ') : 'Open'}</strong></div>
            <div className="multiview-selectors">
              {[firstSlot, firstSlot + 1].map((slotIndex, pairIndex) => (
                <label key={slotIndex}>
                  <span>Team {pairIndex + 1}</span>
                  <select value={teamKeys[slotIndex] ?? ''} onChange={(event) => onTeamChange(slotIndex, event.target.value)}>
                    <option value="">Select a team</option>
                    {teamOptions(slotIndex)}
                  </select>
                </label>
              ))}
            </div>
            <div className="multiview-team-strip">
              {screenTeams.map((team) => <span style={{ '--strip-team-color': team.primary }} key={team.key}>{team.abbreviation}</span>)}
              {!screenTeams.length && <span className="is-empty">Add teams to this screen</span>}
            </div>
            <div className="multiview-leaders">
              {leaders.map((player) => (
                <button type="button" onClick={() => onSelectPlayer(player)} key={`${player.teamKey}:${player.id}`}>
                  <span className="multiview-leader-jersey" style={{ '--jersey-color': player.teamPrimary }}>#{jerseyNumber(player)}</span>
                  <span><strong>{player.name}</strong><small>{player.teamAbbreviation} · {player.position ?? '—'}</small></span>
                  <b>{collegeGradeLabel(player.currentAbility) || '—'}</b>
                </button>
              ))}
              {!leaders.length && <p>Select one or two teams to preview their top players.</p>}
            </div>
          </article>
        ))}
      </div>

      <section className="player-list-section college-list-section multiview-ranking">
        <div className="list-toolbar">
          <div>
            <p className="eyebrow">Combined ranking</p>
            <h2>{selectedTeams.length ? `${selectedTeams.length}-team player ranking` : 'Select teams to begin'}</h2>
            <p className="talent-board-note">On3 college grade · PFF Big Board rank · On3 recruiting rating</p>
          </div>
          <div className="list-filters multiview-filters">
            <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" /></label>
            <label><span>Position</span><select value={position} onChange={(event) => setPosition(event.target.value)}><option value="all">All positions</option>{positions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
            <label><span>Team</span><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="all">All selected teams</option>{selectedTeams.map((team) => <option value={team.key} key={team.key}>{team.name}</option>)}</select></label>
          </div>
        </div>
        <div className="player-grid multiview-player-grid">
          {visiblePlayers.map((player) => {
            const overallRank = rankedPlayers.indexOf(player) + 1;
            return (
              <button className="player-card college-player-card multiview-player-card" type="button" onClick={() => onSelectPlayer(player)} key={`${player.teamKey}:${player.id}`}>
                <span className="rank">{String(overallRank).padStart(2, '0')}</span>
                <span className="multiview-jersey" style={{ '--jersey-color': player.teamPrimary }}><small>#</small>{jerseyNumber(player)}</span>
                <span className="position-pill">{player.position ?? '—'}</span>
                <span className="college-player-identity">
                  <span className="player-card-name">
                    {player.name}{player.recruiting?.stars === 5 && <span className="five-star" title="On3 five-star high-school recruit">★</span>}
                    {player.pffBigBoard && <span className="pff-rank-label talent-pff-rank" title={`${player.pffBigBoard.draftYear} PFF Big Board rank`}>PFF #{player.pffBigBoard.rank}</span>}
                  </span>
                  <span className="talent-player-team" style={{ '--player-team-color': player.teamPrimary }}>{player.teamName} {player.teamMascot}</span>
                </span>
                <span className="talent-rating on3-rating" title="On3 current college ability">
                  <small>On3 grade</small>
                  <strong>{collegeGradeLabel(player.currentAbility) || '—'}</strong>
                  <span>{player.currentAbility?.nationalRank ? `#${player.currentAbility.nationalRank} NATL` : 'Not ranked'}</span>
                </span>
              </button>
            );
          })}
          {!visiblePlayers.length && <div className="empty-state"><strong>No ranked players found</strong><span>{selectedTeams.length ? 'Try another filter.' : 'Choose teams in the four screens above.'}</span></div>}
        </div>
      </section>
    </section>
  );
}
