import { useMemo, useState } from 'react';
import { ratingLabel } from '../lib/college';

export default function CollegePlayerList({ players, onSelectPlayer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const visible = useMemo(() => players
    .filter((player) => player.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((player) => filter === 'five-star' ? player.recruiting?.stars === 5 : filter === 'transfer' ? player.isTransfer || player.transfer : true)
    .sort((left, right) => (right.recruiting?.rating ?? -1) - (left.recruiting?.rating ?? -1) || left.name.localeCompare(right.name)),
  [filter, players, search]);

  return (
    <section className="player-list-section college-list-section">
      <div className="list-toolbar">
        <div>
          <p className="eyebrow">Talent board</p>
          <h2>Players on the depth chart</h2>
        </div>
        <div className="list-filters">
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" /></label>
          <label><span>Talent filter</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All players</option><option value="five-star">Five-star recruits</option><option value="transfer">Transfers</option></select></label>
        </div>
      </div>
      <div className="player-grid">
        {visible.map((player, index) => (
          <button className="player-card college-player-card" type="button" onClick={() => onSelectPlayer(player)} key={player.id}>
            <span className="rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="position-pill">{player.position ?? '—'}</span>
            <span className="player-card-name">{player.name}{player.recruiting?.stars === 5 && <span className="five-star" title="On3 five-star high-school recruit">★</span>}</span>
            <span className="player-card-stat"><strong>{player.recruiting?.rating ? Number(player.recruiting.rating).toFixed(1) : '—'}</strong><small>{ratingLabel(player.recruiting)}{player.isTransfer || player.transfer ? ' · TR' : ''}</small></span>
            <span className="card-arrow">↗</span>
          </button>
        ))}
        {!visible.length && <div className="empty-state"><strong>No players found</strong><span>Try another name or talent filter.</span></div>}
      </div>
    </section>
  );
}
