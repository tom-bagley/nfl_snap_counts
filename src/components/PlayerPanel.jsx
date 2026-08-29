import { useEffect } from 'react';
import { teamFor } from '../lib/teams';

export default function PlayerPanel({ player, history, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  if (!player) return null;
  const sortedHistory = [...history].sort((left, right) => right.season - left.season || right.offense - left.offense);

  return (
    <div className="panel-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="player-panel" role="dialog" aria-modal="true" aria-labelledby="player-panel-title">
        <button className="close-button" type="button" onClick={onClose} aria-label="Close player details">×</button>
        <p className="eyebrow">Player history</p>
        <div className="panel-title-row">
          <span className="panel-position">{player.position}</span>
          <div>
            <h2 id="player-panel-title">{player.playerName}</h2>
            <p>{sortedHistory.length} team-season record{sortedHistory.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="panel-stats">
          <div><strong>{player.offense.toLocaleString()}</strong><span>Offense</span></div>
          <div><strong>{player.defense.toLocaleString()}</strong><span>Defense</span></div>
          <div><strong>{player.specialTeams.toLocaleString()}</strong><span>Special teams</span></div>
        </div>

        <div className="history-list">
          {sortedHistory.map((row) => {
            const team = teamFor(row.team);
            return (
              <article className="history-row" key={row.id}>
                <span className="history-season">{row.season}</span>
                <span className="history-team" style={{ '--team-color': team.primary }}>{team.short}</span>
                <span className="history-position">{row.position}</span>
                <dl>
                  <div><dt>OFF</dt><dd>{row.offense.toLocaleString()}</dd></div>
                  <div><dt>DEF</dt><dd>{row.defense.toLocaleString()}</dd></div>
                  <div><dt>ST</dt><dd>{row.specialTeams.toLocaleString()}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
