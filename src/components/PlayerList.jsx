import { snapTotal } from '../lib/data';

const LABELS = {
  offense: 'offensive',
  defense: 'defensive',
  specialTeams: 'special teams',
};

export default function PlayerList({ rows, category, search, position, onSearch, onPosition, onSelectPlayer }) {
  const positions = [...new Set(rows.map((row) => row.position))].sort();
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = rows
    .filter((row) => position === 'all' || row.position === position)
    .filter((row) => row.playerName.toLowerCase().includes(normalizedSearch))
    .sort((left, right) => snapTotal(right, category) - snapTotal(left, category) || left.playerName.localeCompare(right.playerName));

  return (
    <section className="list-section">
      <div className="list-toolbar">
        <div>
          <p className="eyebrow">Roster explorer</p>
          <h2>{filtered.length} players</h2>
        </div>
        <div className="list-filters">
          <label>
            <span>Search</span>
            <input value={search} onChange={(event) => onSearch(event.target.value)} type="search" placeholder="Player name" />
          </label>
          <label>
            <span>Position</span>
            <select value={position} onChange={(event) => onPosition(event.target.value)}>
              <option value="all">All positions</option>
              {positions.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="player-grid">
          {filtered.map((row, index) => (
            <button className="player-card" type="button" onClick={() => onSelectPlayer(row)} key={row.id}>
              <span className="rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="position-pill">{row.position}</span>
              <span className="player-card-name">{row.playerName}</span>
              <span className="player-card-stat">
                <strong>{snapTotal(row, category).toLocaleString()}</strong>
                <small>{LABELS[category]} snaps</small>
              </span>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No players found</strong>
          <span>Try clearing the search or position filter.</span>
        </div>
      )}
    </section>
  );
}
