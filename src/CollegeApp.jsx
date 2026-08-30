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

function playersOnChart(team, playersById) {
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
}

export default function CollegeApp({ onLeagueChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [teamKey, setTeamKey] = useState('alabama');
  const [opponentKey, setOpponentKey] = useState('georgia');
  const [matchupSwapped, setMatchupSwapped] = useState(false);
  const [view, setView] = useState('depth');
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
  const opponent = data?.teams.find((item) => item.key === opponentKey) ?? data?.teams.find((item) => item.key !== team?.key);
  const playersById = useMemo(() => new Map((team?.players ?? []).map((player) => [player.id, player])), [team]);
  const opponentPlayersById = useMemo(() => new Map((opponent?.players ?? []).map((player) => [player.id, player])), [opponent]);
  const chartPlayers = useMemo(() => playersOnChart(team, playersById), [playersById, team]);
  const opponentChartPlayers = useMemo(() => playersOnChart(opponent, opponentPlayersById), [opponent, opponentPlayersById]);

  if (error) return <ErrorState message={error} />;
  if (!data || !team || !opponent) return <LoadingState />;

  const rankedProspects = new Set([...chartPlayers, ...opponentChartPlayers].filter((player) => player.pffBigBoard).map((player) => `${player.pffBigBoard.rank}-${player.name}`)).size;
  const groupedTeams = data.conferences.map((conference) => [conference, data.teams.filter((item) => item.conference === conference)]);
  const offenseTeam = matchupSwapped ? opponent : team;
  const defenseTeam = matchupSwapped ? team : opponent;
  const offensePlayersById = matchupSwapped ? opponentPlayersById : playersById;
  const defensePlayersById = matchupSwapped ? playersById : opponentPlayersById;
  const offenseChartPlayers = matchupSwapped ? opponentChartPlayers : chartPlayers;
  const defenseChartPlayers = matchupSwapped ? chartPlayers : opponentChartPlayers;
  const offenseLayoutKey = `${offenseTeam.key}:offense`;
  const defenseLayoutKey = `${defenseTeam.key}:defense`;
  const offenseLayout = savedLayouts[offenseLayoutKey] ?? {};
  const defenseLayout = savedLayouts[defenseLayoutKey] ?? {};

  const savePosition = (layoutKey, position, coordinates) => {
    setSavedLayouts((existing) => {
      const next = { ...existing, [layoutKey]: { ...(existing[layoutKey] ?? {}), [position]: coordinates } };
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };
  const resetPositions = (layoutKey) => {
    setSavedLayouts((existing) => {
      const next = { ...existing };
      delete next[layoutKey];
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const teamOptions = (excludedKey) => groupedTeams.map(([conference, teams]) => (
    <optgroup label={conference} key={conference}>
      {teams.map((item) => <option value={item.key} disabled={item.key === excludedKey} key={item.key}>{item.name} {item.mascot}</option>)}
    </optgroup>
  ));

  return (
    <div className="app-shell college-shell matchup-shell" style={{ '--team-primary': offenseTeam.primary, '--team-secondary': offenseTeam.secondary }}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Snap Atlas home"><span className="brand-mark">SA</span><span><strong>SNAP ATLAS</strong><small>Football personnel intelligence</small></span></a>
        <div className="header-tools">
          <div className="league-switch" role="group" aria-label="League">
            <button type="button" onClick={() => onLeagueChange('nfl')}>NFL</button>
            <button className="active" type="button">College</button>
          </div>
          <div className="data-stamp"><span className="live-dot" />{data.metadata.season} depth charts · On3 talent{data.metadata.pffBigBoardDraftYear ? ` · ${data.metadata.pffBigBoardDraftYear} PFF board` : ''}</div>
        </div>
      </header>

      <main id="top">
        <section className="team-hero college-hero matchup-hero">
          <div className="hero-glow" />
          <div className="team-monogram" aria-hidden="true">{team.abbreviation}/{opponent.abbreviation}</div>
          <div className="hero-copy"><p className="eyebrow">{team.conference} vs {opponent.conference} · {data.metadata.season}</p><h1>{team.name} vs {opponent.name}</h1><p>Put either offense against the other defense, then swap sides with one click.</p></div>
          <div className="hero-metrics">
            <div><strong>{chartPlayers.length}</strong><span>{team.abbreviation} chart players</span></div>
            <div><strong>{opponentChartPlayers.length}</strong><span>{opponent.abbreviation} chart players</span></div>
            <div><strong>{rankedProspects}</strong><span>PFF prospects in matchup</span></div>
          </div>
        </section>

        <section className="control-deck college-controls matchup-controls" aria-label="College matchup controls">
          <label><span>Team A</span><select value={team.key} onChange={(event) => { setTeamKey(event.target.value); setMatchupSwapped(false); setSelectedPlayer(null); }}>{teamOptions(opponent.key)}</select></label>
          <label><span>Team B</span><select value={opponent.key} onChange={(event) => { setOpponentKey(event.target.value); setMatchupSwapped(false); setSelectedPlayer(null); }}>{teamOptions(team.key)}</select></label>
          <div className="segmented-control" aria-label="View"><span>View</span><div><button className={view === 'depth' ? 'active' : ''} type="button" onClick={() => setView('depth')}>Matchup</button><button className={view === 'list' ? 'active' : ''} type="button" onClick={() => setView('list')}>Team A talent</button></div></div>
          <div className="matchup-swap-control"><span>Current sides</span><button className="matchup-swap-button" type="button" onClick={() => setMatchupSwapped((current) => !current)}><strong>Swap offense ↔ defense</strong><small>{offenseTeam.abbreviation} offense · {defenseTeam.abbreviation} defense</small></button></div>
          <div className="college-key"><span className="five-star">★</span><div><strong>On3 five-star recruit</strong><small>Gold stars reflect high-school recruiting only</small></div></div>
        </section>

        {view === 'depth' ? (
          <section className="depth-section matchup-depth-section">
            <div className="section-heading matchup-heading"><div><p className="eyebrow">Matchup view</p><h2>{offenseTeam.name} offense vs {defenseTeam.name} defense</h2></div><button className="matchup-main-swap" type="button" onClick={() => setMatchupSwapped((current) => !current)}><span aria-hidden="true">⇄</span> Switch sides</button></div>
            <div className="matchup-unit" style={{ '--team-primary': offenseTeam.primary, '--team-secondary': offenseTeam.secondary }}>
              <div className="matchup-unit-heading"><div><span>Offense</span><strong>{offenseTeam.name} {offenseTeam.mascot}</strong></div><button className="reset-layout" type="button" onClick={() => resetPositions(offenseLayoutKey)} disabled={!Object.keys(offenseLayout).length}>Reset positions</button></div>
              <div className="chart-context"><span>{data.metadata.season} offense</span><span>{offenseChartPlayers.length} unique players mapped</span><span className="drag-instruction">Drag a position label to customize the formation</span></div>
              <CollegeDepthChart chart={offenseTeam.depthCharts.offense} unit="offense" playersById={offensePlayersById} customLayout={offenseLayout} onPositionMove={(position, coordinates) => savePosition(offenseLayoutKey, position, coordinates)} onSelectPlayer={setSelectedPlayer} />
            </div>
            <div className="matchup-divider" aria-hidden="true"><span>{offenseTeam.abbreviation}</span><strong>OFFENSE / DEFENSE</strong><span>{defenseTeam.abbreviation}</span></div>
            <div className="matchup-unit" style={{ '--team-primary': defenseTeam.primary, '--team-secondary': defenseTeam.secondary }}>
              <div className="matchup-unit-heading"><div><span>Defense</span><strong>{defenseTeam.name} {defenseTeam.mascot}</strong></div><button className="reset-layout" type="button" onClick={() => resetPositions(defenseLayoutKey)} disabled={!Object.keys(defenseLayout).length}>Reset positions</button></div>
              <div className="chart-context"><span>{data.metadata.season} defense</span><span>{defenseChartPlayers.length} unique players mapped</span><span className="drag-instruction">Drag a position label to customize the formation</span></div>
              <CollegeDepthChart chart={defenseTeam.depthCharts.defense} unit="defense" playersById={defensePlayersById} customLayout={defenseLayout} onPositionMove={(position, coordinates) => savePosition(defenseLayoutKey, position, coordinates)} onSelectPlayer={setSelectedPlayer} />
            </div>
          </section>
        ) : <CollegePlayerList players={chartPlayers} teamName={`${team.name} ${team.mascot}`} onSelectPlayer={setSelectedPlayer} />}
      </main>

      <footer><span>Snap Atlas · College Football</span><span>{data.metadata.teamCount} teams · {data.metadata.rosterPlayerCount.toLocaleString()} roster players · Generated {formatDate(data.metadata.generatedAt)}</span><span>Sources: Ourlads, On3 &amp; PFF</span></footer>
      <CollegePlayerPanel player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
    </div>
  );
}
