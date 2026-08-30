import { useEffect } from 'react';
import { rankLabel, ratingLabel } from '../lib/college';

function RatingBlock({ title, rating, transfer = false, collegeGrade = false }) {
  if (!rating) {
    return (
      <section className="college-rating-block">
        <p className="eyebrow">{title}</p>
        <h3>Not rated</h3>
        <p>No matching {collegeGrade ? 'current college-player' : transfer ? 'portal' : 'high-school recruiting'} rating was found.</p>
      </section>
    );
  }
  return (
    <section className="college-rating-block">
      <p className="eyebrow">{title}</p>
      <div className="rating-title">
        <h3>{collegeGrade ? Number(rating.rating).toFixed(0) : ratingLabel(rating)}</h3>
        {!transfer && rating.stars === 5 && <span className="five-star panel-star" title="On3 five-star high-school recruit">★</span>}
      </div>
      {transfer && (rating.fromTeam || rating.toTeam) && <p>{rating.fromTeam || 'Previous school unavailable'} → {rating.toTeam || 'Current school'}</p>}
      <dl className="college-ranks">
        <div><dt>National</dt><dd>{rankLabel(rating.nationalRank, 'NATL')}</dd></div>
        <div><dt>Position</dt><dd>{rankLabel(rating.positionRank, rating.position ?? 'POS')}</dd></div>
        <div><dt>{collegeGrade ? 'Grade year' : transfer ? 'Portal year' : 'State'}</dt><dd>{collegeGrade ? rating.year ?? '—' : transfer ? rating.portalYear ?? '—' : rankLabel(rating.stateRank, rating.state ?? 'STATE')}</dd></div>
      </dl>
    </section>
  );
}

function SchoolHistory({ history, verified }) {
  const seasons = (history ?? []).flatMap((entry) => {
    const startYear = Number(entry.startYear);
    const endYear = Number(entry.endYear);
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) return [];
    return Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => ({
      ...entry,
      year: startYear + index,
    }));
  }).sort((left, right) => right.year - left.year);

  if (!seasons.length) return null;
  return (
    <section className="school-history-block">
      <p className="eyebrow">College career</p>
      <div className="school-history-title">
        <h3>School history</h3>
        <span>{seasons.length} season{seasons.length === 1 ? '' : 's'}</span>
      </div>
      <div className="school-history-list">
        {seasons.map((season, index) => (
          <div className="school-history-row" key={`${season.organizationKey}-${season.year}-${index}`}>
            <span className="school-history-year">{season.year}</span>
            <span className="school-history-mark" style={{ '--school-color': season.primary || 'var(--team-primary)' }}>{season.abbreviation || season.team.slice(0, 3)}</span>
            <strong>{season.team}</strong>
            {index === 0 && <small>Current</small>}
          </div>
        ))}
      </div>
      <p className="school-history-note">
        {verified
          ? 'School ranges reflect On3 organization history.'
          : 'Continuous enrollment is inferred from the On3 recruiting class and current roster.'}
      </p>
    </section>
  );
}

export default function CollegePlayerPanel({ player, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  if (!player) return null;
  return (
    <div className="panel-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="player-panel" role="dialog" aria-modal="true" aria-labelledby="college-player-panel-title">
        <button className="close-button" type="button" onClick={onClose} aria-label="Close player profile">×</button>
        <p className="eyebrow">College player profile</p>
        <div className="panel-title-row">
          <span className="panel-position">{player.position ?? '—'}</span>
          <div>
            <h2 id="college-player-panel-title">{player.name}</h2>
            <p>#{player.jerseyNumber ?? '—'} · {player.classRank || 'Class unavailable'}{player.isTransfer ? ' · Transfer' : ''}</p>
          </div>
        </div>

        <div className="college-profile-facts">
          <div><span>Height / weight</span><strong>{player.height || '—'} / {player.weight ? `${player.weight} lbs` : '—'}</strong></div>
          <div><span>High school</span><strong>{player.highSchool || '—'}</strong></div>
          <div><span>Hometown</span><strong>{player.hometown || '—'}</strong></div>
        </div>

        {player.currentAbility && <RatingBlock title="On3 current college ability" rating={player.currentAbility} collegeGrade />}
        <SchoolHistory history={player.schoolHistory} verified={player.schoolHistoryVerified} />
        <RatingBlock title="On3 high-school recruiting" rating={player.recruiting} />
        {(player.isTransfer || player.transfer) && <RatingBlock title="On3 transfer rating" rating={player.transfer} transfer />}

        {player.slug && (
          <a className="source-link" href={`https://www.on3.com/db/${player.slug}/`} target="_blank" rel="noreferrer">
            View player source on On3 <span aria-hidden="true">↗</span>
          </a>
        )}
      </aside>
    </div>
  );
}
