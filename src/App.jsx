import { useEffect, useMemo, useState } from 'react';
import CollegeApp from './CollegeApp';
import DepthChart from './components/DepthChart';
import PlayerList from './components/PlayerList';
import PlayerPanel from './components/PlayerPanel';
import { formatDate, loadNflData, snapTotal } from './lib/data';
import { teamEntries, teamFor } from './lib/teams';
import useStoredState from './hooks/useStoredState';

const LAYOUT_STORAGE_KEY = 'snap-atlas-position-layouts';

function loadSavedLayouts() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function LoadingState() {
  return (
    <main className="status-page">
      <div className="loader" aria-hidden="true"><span /><span /><span /></div>
      <h1>Loading the league</h1>
      <p>Preparing snap counts and depth charts.</p>
    </main>
  );
}

function ErrorState({ message }) {
  return (
    <main className="status-page">
      <div className="error-mark">!</div>
      <h1>We couldn’t load the data</h1>
      <p>{message}</p>
      <p className="status-hint">Run <code>npm run prepare-data</code> and refresh the page.</p>
    </main>
  );
}

function NflApp({ onLeagueChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [teamCode, setTeamCode] = useStoredState('snap-atlas-nfl-team', 'crd', (value) => teamEntries.some(([code]) => code === value));
  const [season, setSeason] = useStoredState('snap-atlas-nfl-season', null, (value) => Number.isInteger(value));
  const [view, setView] = useStoredState('snap-atlas-nfl-view', 'depth', (value) => ['depth', 'list'].includes(value));
  const [unit, setUnit] = useStoredState('snap-atlas-nfl-unit', 'offense', (value) => ['offense', 'defense'].includes(value));
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [savedLayouts, setSavedLayouts] = useState(loadSavedLayouts);

  useEffect(() => {
    const controller = new AbortController();
    loadNflData(controller.signal)
      .then((result) => {
        setData(result);
        setSeason((current) => result.metadata.seasons.includes(current) ? current : result.metadata.depthChartSeason);
      })
      .catch((caught) => {
        if (caught.name !== 'AbortError') setError(caught.message);
      });
    return () => controller.abort();
  }, []);

  const rows = useMemo(
    () => data?.snapCounts.filter((row) => row.season === season && row.team === teamCode) ?? [],
    [data, season, teamCode],
  );
  const history = useMemo(
    () => data?.snapCounts.filter((row) => row.playerKey === selectedPlayer?.playerKey) ?? [],
    [data, selectedPlayer],
  );
  const depthRows = useMemo(() => {
    const seasonRows = data?.snapCounts.filter((row) => row.season === season) ?? [];
    const combined = new Map();
    seasonRows.forEach((row) => {
      const existing = combined.get(row.playerKey);
      if (existing) {
        existing.offense += row.offense;
        existing.defense += row.defense;
        existing.specialTeams += row.specialTeams;
        if (!existing.teams.includes(row.team)) existing.teams.push(row.team);
      } else {
        combined.set(row.playerKey, { ...row, teams: [row.team], id: `depth-${season}-${row.playerKey}` });
      }
    });
    return [...combined.values()];
  }, [data, season]);

  if (error) return <ErrorState message={error} />;
  if (!data || season === null) return <LoadingState />;

  const { metadata, depthCharts } = data;
  const team = teamFor(teamCode);
  const chartAvailable = Boolean(depthCharts[teamCode]);
  const seasonHasSnaps = data.snapCounts.some((row) => row.season === season);
  const seasonTeamCount = new Set(data.snapCounts.filter((row) => row.season === season).map((row) => row.team)).size;
  const leader = [...rows].sort((left, right) => snapTotal(right, unit) - snapTotal(left, unit))[0];
  const unitTotal = rows.reduce((sum, row) => sum + snapTotal(row, unit), 0);

  const chooseTeam = (value) => {
    setTeamCode(value);
    setPosition('all');
    setSearch('');
    setSelectedPlayer(null);
  };
  const layoutKey = `${teamCode}:${unit}`;
  const currentLayout = savedLayouts[layoutKey] ?? {};

  const savePosition = (positionName, coordinates) => {
    setSavedLayouts((existing) => {
      const next = { ...existing, [layoutKey]: { ...(existing[layoutKey] ?? {}), [positionName]: coordinates } };
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

  const chooseUnit = (nextUnit) => {
    setUnit(nextUnit);
    setPosition('all');
    setSelectedPlayer(null);
  };
  const unitControl = (
    <div className="unit-switch" role="group" aria-label="Unit">
      <button className={unit === 'offense' ? 'active' : ''} aria-pressed={unit === 'offense'} type="button" onClick={() => chooseUnit('offense')}>Offense</button>
      <button className={unit === 'defense' ? 'active' : ''} aria-pressed={unit === 'defense'} type="button" onClick={() => chooseUnit('defense')}>Defense</button>
    </div>
  );

  return (
    <div className="app-shell" style={{ '--team-primary': team.primary, '--team-secondary': team.secondary }}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="NFL Snap Atlas home">
          <span className="brand-mark">SA</span>
          <span><strong>SNAP ATLAS</strong><small>NFL personnel intelligence</small></span>
        </a>
        <div className="header-tools">
          <div className="league-switch" role="group" aria-label="League">
            <button className="active" type="button">NFL</button>
            <button type="button" onClick={() => onLeagueChange('college')}>College</button>
          </div>
          <div className="data-stamp">
            <span className="live-dot" />
            {metadata.depthChartSeason} rosters · snaps through {metadata.latestSeason}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="team-hero">
          <div className="hero-glow" />
          <div className="team-monogram" aria-hidden="true">{team.short}</div>
          <div className="hero-copy">
            <p className="eyebrow">{season} season overview</p>
            <h1>{team.name}</h1>
            <p>Personnel, workload, and depth—mapped onto the field.</p>
          </div>
          <div className="hero-metrics">
            <div><strong>{rows.length}</strong><span>Players with snaps</span></div>
            <div><strong>{unitTotal.toLocaleString()}</strong><span>{unit === 'offense' ? 'Offensive' : 'Defensive'} snaps</span></div>
            <div><strong>{leader?.playerName ?? '—'}</strong><span>Team leader · {leader ? snapTotal(leader, unit).toLocaleString() : 0}</span></div>
          </div>
        </section>

        <section className="control-deck" aria-label="Data controls">
          <label>
            <span>Team</span>
            <select value={teamCode} onChange={(event) => chooseTeam(event.target.value)}>
              {teamEntries.map(([code, item]) => <option value={code} key={code}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span>Season</span>
            <select value={season} onChange={(event) => { setSeason(Number(event.target.value)); setSelectedPlayer(null); }}>
              {metadata.seasons.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
          </label>
          <div className="segmented-control" aria-label="View">
            <span>View</span>
            <div>
              <button className={view === 'depth' ? 'active' : ''} type="button" onClick={() => setView('depth')}>Depth chart</button>
              <button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')}>Player list</button>
            </div>
          </div>
        </section>

        {seasonTeamCount > 0 && seasonTeamCount < 32 && (
          <div className="season-notice">
            <span className="notice-icon">i</span>
            <div>
              <h3>{season} snap coverage: {seasonTeamCount} of 32 teams</h3>
              <p>{rows.length ? 'Showing available regular-season games.' : `Snap counts for ${team.name} are not available in the current update.`}</p>
            </div>
          </div>
        )}

        {view === 'depth' ? (
          <section className="depth-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">On-field view</p>
                <h2>{unit === 'offense' ? 'Offensive' : 'Defensive'} depth chart</h2>
              </div>
              <div className="chart-actions">
                <button className="reset-layout" type="button" onClick={resetPositions} disabled={Object.keys(currentLayout).length === 0}>Reset positions</button>
                {unitControl}
              </div>
            </div>
            {chartAvailable ? (
              <>
                <div className="chart-context">
                  <span>{metadata.depthChartSeason} current depth chart</span>
                  <span>{seasonHasSnaps ? `Showing ${season} snap totals` : `${season} snaps not available`}</span>
                  <span className="drag-instruction">Drag a position label to customize the formation</span>
                </div>
                <DepthChart
                  chart={depthCharts[teamCode][unit]}
                  unit={unit}
                  rows={depthRows}
                  historyRows={data.snapCounts}
                  season={season}
                  teamCode={teamCode}
                  category={unit}
                  emptySeason={!seasonHasSnaps}
                  customLayout={currentLayout}
                  onPositionMove={savePosition}
                  onSelectPlayer={setSelectedPlayer}
                />
              </>
            ) : (
              <div className="season-notice">
                <span className="notice-icon">!</span>
                <div>
                  <h3>Depth chart unavailable</h3>
                  <p>The current source file does not contain a depth chart for this team.</p>
                </div>
              </div>
            )}
          </section>
        ) : (
          <PlayerList
            rows={rows}
            category={unit}
            unitControl={unitControl}
            search={search}
            position={position}
            onSearch={setSearch}
            onPosition={setPosition}
            onSelectPlayer={setSelectedPlayer}
          />
        )}
      </main>

      <footer>
        <span>Snap Atlas · NFL</span>
        <span>{metadata.rowCount.toLocaleString()} records · Generated {formatDate(metadata.generatedAt)}</span>
        <span>Sources: {metadata.sources.snapCounts} &amp; {metadata.sources.depthCharts}</span>
      </footer>

      <PlayerPanel player={selectedPlayer} history={history} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
}

export default function App() {
  const [league, setLeague] = useStoredState(
    'snap-atlas-league',
    'nfl',
    (value) => ['nfl', 'college'].includes(value),
    window.location.hash === '#college' ? 'college' : undefined,
  );

  const chooseLeague = (nextLeague) => {
    setLeague(nextLeague);
    window.history.replaceState(null, '', nextLeague === 'college' ? '#college' : window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return league === 'college'
    ? <CollegeApp onLeagueChange={chooseLeague} />
    : <NflApp onLeagueChange={chooseLeague} />;
}
