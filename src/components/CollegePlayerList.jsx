import { useMemo, useState } from 'react';
import { collegeGradeLabel } from '../lib/college';

export default function CollegePlayerList({ players, teamName, onSelectPlayer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const visible = useMemo(() => players
    .filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((player) => filter === 'five-star'
      ? player.recruiting?.stars === 5
      : filter === 'transfer'
        ? player.isTransfer || player.transfer
        : filter === 'pff'
          ? player.pffBigBoard
          : true)
    .sort((left, right) => (right.currentAbility?.rating ?? -1) - (left.currentAbility?.rating ?? -1) || (right.recruiting?.rating ?? -1) - (left.recruiting?.rating ?? -1) || left.name.localeCompare(right.name)),
  [filter, players, search]);

  return (
    <section className="player-list-section college-list-section">
      <div className="list-toolbar">
        <div>
          <p className="eyebrow">Talent board</p>
          <h2>{teamName ? `${teamName} players` : 'Players on the depth chart'}</h2>
          <p className="talent-board-note">On3 college grade and national rank · PFF Big Board rank</p>
        </div>
        <div className="list-filters">
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" /></label>
          <label><span>Talent filter</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All players</option><option value="pff">PFF prospects</option><option value="five-star">Five-star recruits</option><option value="transfer">Transfers</option></select></label>
        </div>
      </div>
      <div className="player-grid">
        {visible.map((player, index) => (
          <button className="player-card college-player-card" type="button" onClick={() => onSelectPlayer(player)} key={player.id}>
            <span className="rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="position-pill">{player.position ?? '—'}</span>
            <span className="player-card-name">{player.name}{player.recruiting?.stars === 5 && <span className="five-star" title="On3 five-star high-school recruit">★</span>}</span>
            <span className="college-talent-ratings">
              <span className="talent-rating on3-rating" title="On3 current college ability">
                <small>On3 grade</small>
                <strong>{collegeGradeLabel(player.currentAbility) || '—'}</strong>
                <span>{player.currentAbility?.nationalRank ? `#${player.currentAbility.nationalRank} NATL` : 'Not ranked'}</span>
              </span>
              <span className={`talent-rating pff-rating${player.pffBigBoard ? ' is-ranked' : ''}`} title={player.pffBigBoard ? `${player.pffBigBoard.draftYear} PFF Big Board rank` : 'Not listed on the PFF Big Board'}>
                <small>PFF board</small>
                <strong>{player.pffBigBoard ? `#${player.pffBigBoard.rank}` : '—'}</strong>
                <span>{player.pffBigBoard ? `${player.pffBigBoard.draftYear} class` : 'Not listed'}</span>
              </span>
            </span>
            <span className="card-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
        {!visible.length && <div className="empty-state"><strong>No players found</strong><span>Try another name or talent filter.</span></div>}
      </div>
    </section>
  );
}
