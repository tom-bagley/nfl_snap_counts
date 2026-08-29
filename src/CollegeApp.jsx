import { useEffect, useMemo, useState } from 'react';
import CollegeDepthChart from './components/CollegeDepthChart';
import CollegePlayerList from './components/CollegePlayerList';
import CollegePlayerPanel from './components/CollegePlayerPanel';
import { loadCollegeData } from './lib/college';
import { formatDate } from './lib/data';

const LAYOUT_STORAGE_KEY = 'snap-atlas-college-position-layouts';

function loadSavedLayouts() {
  try { return JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY)) ?? {}; } catch { return {}; }
}

function LoadingState() {
  return <main className="status-page"><div className="loader" aria-hidden="true"><span /><span /><span /></div><h1>Loading college football</h1><p>Preparing depth charts and recruiting profiles.</p></main>;
}

function ErrorState({ message }) {
  return <main className="status-page"><div className="error-mark">!</div><h1>We couldn’t load college data</h1><p>{message}</p><p className="status-hint">Run <code>npm run collect:college-data -- 2026</code> and refresh.</p></main>;
}

export default function CollegeApp({ onLeagueChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [teamKey, setTeamKey] = useState('alabama');
  const [view, setView] = useState('depth');
  const [unit, setUnit] = useState('offense');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [savedLayouts, setSavedLayouts] = useState(loadSavedLayouts);

  useEffect(() => {
    const controller = new AbortController();
    loadCollegeData(controller.signal).then(setData).catch((caught) => {
      if (caught.name !== 'AbortError') setError(caught.message);
    });
    return () => controller.abort();
  }, []);

  const team = data?.teams.find((item) => item.key === teamKey) ?? data?.teams[0];
  const playersById = useMemo(() => new Map((team?.players ?? []).map((player) => [player.id, player])), [team]);
  const chartPlayers = useMemo(() => {
    if (!team) return [];
    const unique = new Map();
    ['offense', 'defense'].forEach((chartUnit) => Object.entries(team.depthCharts[chartUnit]).forEach(([position, depthPlayers]) => {
      depthPlayers.forEach((depthPlayer) => {
        const roster = playersById.get(depthPlayer.playerId);
        const key = roster?.id ?? depthPlayer.normalizedName;
        if (!unique.has(key)) unique.set(key, {
          ...(roster ?? {}),
          id: key,
          name: roster?.name ?? depthPlayer.name,
          position: roster?.position ?? position,
          jerseyNumber: depthPlayer.num || roster?.jerseyNumber,
          classRank: depthPlayer.classRank || roster?.classRank,
          isTransfer: depthPlayer.isTransfer,
        });
        else if (depthPlayer.isTransfer) unique.get(key).isTransfer = true;
      });
    }));
    return [...unique.values()];
  }, [playersById, team]);

  if (error) return <ErrorState message={error} />;
  if (!data || !team) return <LoadingState />;

  const fiveStars = chartPlayers.filter((player) => player.recruiting?.stars === 5).length;
  const ratedPlayers = chartPlayers.filter((player) => Number.isFinite(player.recruiting?.rating));
  const blueChips = ratedPlayers.filter((player) => (player.recruiting?.stars ?? 0) >= 4).length;
  const transfers = chartPlayers.filter((player) => player.isTransfer).length;
  const groupedTeams = data.conferences.map((conference) => [conference, data.teams.filter((item) => item.conference === conference)]);
  const layoutKey = `${team.key}:${unit}`;
  const currentLayout = savedLayouts[layoutKey] ?? {};

  const savePosition = (position, coordinates) => {
    setSavedLayouts((existing) => {
      const next = { ...existing, [layoutKey]: { ...(existing[layoutKey] ?? {}), [position]: coordinates } };
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const resetPositions = () => {
    setSavedLayouts((existing) => {
      const next = { ...existing };
      delete next[layoutKey];
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="app-shell college-shell" style={{ '--team-primary': team.primary, '--team-secondary': team.secondary }}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Snap Atlas home"><span className="brand-mark">SA</span><span><strong>SNAP ATLAS</strong><small>Football personnel intelligence</small></span></a>
        <div className="header-tools">
          <div className="league-switch" role="group" aria-label="League">
            <button type="button" onClick={() => onLeagueChange('nfl')}>NFL</button>
            <button className="active" type="button">College</button>
          </div>
          <div className="data-stamp"><span className="live-dot" />{data.metadata.season} depth charts · On3 talent data</div>
        </div>
      </header>

      <main id="top">
        <section className="team-hero college-hero">
          <div className="hero-glow" />
          <div className="team-monogram" aria-hidden="true">{team.abbreviation || team.name.slice(0, 3)}</div>
          <div className="hero-copy"><p className="eyebrow">{team.conference} · {data.metadata.season} roster</p><h1>{team.name} {team.mascot}</h1><p>Current depth, high-school recruiting pedigree, and portal talent—mapped onto the field.</p></div>
          <div className="hero-metrics">
            <div><strong>{fiveStars}</strong><span>Five-star recruits</span></div>
            <div><strong>{ratedPlayers.length ? `${Math.round((blueChips / ratedPlayers.length) * 100)}%` : '—'}</strong><span>Blue-chip rate</span></div>
            <div><strong>{transfers}</strong><span>Transfers on chart</span></div>
          </div>
        </section>

        <section className="control-deck college-controls" aria-label="College data controls">
          <label><span>Team</span><select value={team.key} onChange={(event) => { setTeamKey(event.target.value); setSelectedPlayer(null); }}>{groupedTeams.map(([conference, teams]) => <optgroup label={conference} key={conference}>{teams.map((item) => <option value={item.key} key={item.key}>{item.name} {item.mascot}</option>)}</optgroup>)}</select></label>
          <label><span>Season</span><select value={data.metadata.season} disabled><option>{data.metadata.season}</option></select></label>
          <div className="segmented-control" aria-label="View"><span>View</span><div><button className={view === 'depth' ? 'active' : ''} type="button" onClick={() => setView('depth')}>Depth chart</button><button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')}>Talent list</button></div></div>
          <div className="college-key"><span className="five-star">★</span><div><strong>On3 five-star recruit</strong><small>Gold stars reflect high-school recruiting only</small></div></div>
        </section>

        {view === 'depth' ? (
          <section className="depth-section">
            <div className="section-heading"><div><p className="eyebrow">On-field view</p><h2>{unit === 'offense' ? 'Offensive' : 'Defensive'} depth chart</h2></div><div className="chart-actions"><button className="reset-layout" type="button" onClick={resetPositions} disabled={!Object.keys(currentLayout).length}>Reset positions</button><div className="unit-switch"><button className={unit === 'offense' ? 'active' : ''} type="button" onClick={() => setUnit('offense')}>Offense</button><button className={unit === 'defense' ? 'active' : ''} type="button" onClick={() => setUnit('defense')}>Defense</button></div></div></div>
            <div className="chart-context"><span>{data.metadata.season} current depth chart</span><span>{chartPlayers.length} unique players mapped</span><span className="drag-instruction">Drag a position label to customize the formation</span></div>
            <CollegeDepthChart chart={team.depthCharts[unit]} unit={unit} playersById={playersById} customLayout={currentLayout} onPositionMove={savePosition} onSelectPlayer={setSelectedPlayer} />
          </section>
        ) : <CollegePlayerList players={chartPlayers} onSelectPlayer={setSelectedPlayer} />}
      </main>

      <footer><span>Snap Atlas · College Football</span><span>{data.metadata.teamCount} teams · {data.metadata.rosterPlayerCount.toLocaleString()} roster players · Generated {formatDate(data.metadata.generatedAt)}</span><span>Sources: Ourlads &amp; On3</span></footer>
      <CollegePlayerPanel player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
}
