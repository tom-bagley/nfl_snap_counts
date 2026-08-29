import { useRef } from 'react';
import { formatPlayerName, normalizePlayerName, snapTotal } from '../lib/data';

const LAYOUT = {
  offense: {
    LWR: [8, 12], RWR: [92, 12], SWR: [24, 24], LT: [25, 52], LG: [35, 52], C: [50, 52], RG: [65, 52], RT: [75, 52],
    TE: [79, 37], QB: [50, 72], RB: [50, 90], FB: [66, 88],
  },
  defense: {
    LDE: [24, 18], DE: [24, 18], LDT: [39, 18], DT: [43, 18], NT: [50, 18], RDT: [61, 18], RDE: [76, 18],
    LOLB: [15, 42], WLB: [31, 42], LILB: [41, 42], MLB: [50, 42], RILB: [59, 42], ROLB: [85, 42],
    LCB: [10, 69], NB: [50, 63], SS: [36, 81], FS: [64, 81], RCB: [90, 69],
  },
};

function fallbackPosition(index, total) {
  const columns = Math.min(4, total);
  const column = index % columns;
  const row = Math.floor(index / columns);
  return [14 + column * 24, 18 + row * 25];
}

function PlayerLine({ player, snapRow, category, starter, emptySeason, onSelect }) {
  const hasStats = Boolean(snapRow);
  const snapLabel = hasStats
    ? `${snapTotal(snapRow, category).toLocaleString()} snaps`
    : emptySeason ? '0 snaps' : 'Stats not matched';
  return (
    <button
      className={`depth-player ${starter ? 'is-starter' : ''}`}
      type="button"
      onClick={() => hasStats && onSelect(snapRow)}
      disabled={!hasStats}
      title={hasStats
        ? `View ${formatPlayerName(player.name)} history`
        : emptySeason ? 'No snaps recorded for this season yet' : 'No matching snap-count record'}
    >
      <span className="jersey-number">{player.num || '—'}</span>
      <span className="depth-player-copy">
        <strong>{formatPlayerName(player.name)}</strong>
        <small>{snapLabel}</small>
      </span>
    </button>
  );
}

export default function DepthChart({ chart, unit, rows, category, emptySeason, customLayout, onPositionMove, onSelectPlayer }) {
  const fieldRef = useRef(null);
  const dragRef = useRef(null);
  const rowByName = new Map(rows.map((row) => [row.normalizedName, row]));
  const positions = Object.entries(chart ?? {});

  const moveDrag = (event) => {
    if (!dragRef.current || !fieldRef.current) return;
    event.preventDefault();
    const bounds = fieldRef.current.getBoundingClientRect();
    const left = Math.max(4, Math.min(96, ((event.clientX - bounds.left) / bounds.width) * 100));
    const top = Math.max(7, Math.min(93, ((event.clientY - bounds.top) / bounds.height) * 100));
    onPositionMove(dragRef.current.position, [Number(left.toFixed(2)), Number(top.toFixed(2))]);
  };

  const stopDrag = () => {
    dragRef.current?.element?.classList.remove('is-dragging');
    dragRef.current = null;
    document.body.classList.remove('is-position-dragging');
    window.removeEventListener('mousemove', moveDrag);
    window.removeEventListener('mouseup', stopDrag);
  };

  const startDrag = (event, position) => {
    if (window.matchMedia('(max-width: 1100px)').matches) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const element = event.currentTarget.closest('.position-group');
    dragRef.current = { position, element };
    element?.classList.add('is-dragging');
    document.body.classList.add('is-position-dragging');
    window.addEventListener('mousemove', moveDrag, { passive: false });
    window.addEventListener('mouseup', stopDrag, { once: true });
  };

  const moveWithKeyboard = (event, position, currentPosition) => {
    const distance = event.shiftKey ? 5 : 1;
    const movement = {
      ArrowLeft: [-distance, 0], ArrowRight: [distance, 0], ArrowUp: [0, -distance], ArrowDown: [0, distance],
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    onPositionMove(position, [
      Math.max(4, Math.min(96, currentPosition[0] + movement[0])),
      Math.max(7, Math.min(93, currentPosition[1] + movement[1])),
    ]);
  };

  return (
    <section className={`field field-${unit}`} aria-label={`${unit} depth chart`} ref={fieldRef}>
      <div className="field-markings" aria-hidden="true">
        <span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span>
      </div>
      <div className="formation">
        {positions.map(([position, players], index) => {
          const positionCoordinates = customLayout?.[position] ?? LAYOUT[unit]?.[position] ?? fallbackPosition(index, positions.length);
          const [left, top] = positionCoordinates;
          return (
            <article className="position-group" style={{ '--left': `${left}%`, '--top': `${top}%` }} key={position}>
              <button
                className="position-heading"
                type="button"
                aria-label={`Move ${position} position`}
                title="Drag to move · Arrow keys for fine adjustment"
                onMouseDown={(event) => startDrag(event, position)}
                onKeyDown={(event) => moveWithKeyboard(event, position, positionCoordinates)}
              >
                <span>{position}</span>
                <small><span className="drag-glyph" aria-hidden="true">✥</span>{players.length} deep</small>
              </button>
              <div className="depth-stack">
                {players.map((player, playerIndex) => (
                  <PlayerLine
                    key={`${player.num}-${player.name}`}
                    player={player}
                    snapRow={rowByName.get(normalizePlayerName(player.name))}
                    category={category}
                    starter={playerIndex === 0}
                    emptySeason={emptySeason}
                    onSelect={onSelectPlayer}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
