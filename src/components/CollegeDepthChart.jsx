import { useCallback, useEffect, useRef } from 'react';
import { collegeGradeLabel, ratingLabel } from '../lib/college';

const LAYOUT = {
  offense: {
    'WR-X': [10, 13], LWR: [10, 13], 'WR-Z': [90, 13], RWR: [90, 13], 'WR-H': [22, 27], SWR: [22, 27],
    LT: [16, 52], LG: [33, 52], C: [50, 52], RG: [67, 52], RT: [84, 52], TE: [82, 37],
    QB: [50, 72], RB: [50, 90], FB: [67, 87],
  },
  defense: {
    DE: [24, 18], LDE: [22, 18], DT: [40, 18], NT: [50, 18], RDT: [60, 18], RDE: [76, 18], EDGE: [83, 36],
    WOLF: [17, 39], STING: [30, 42], WLB: [31, 42], LB: [43, 42], MLB: [50, 42], ILB: [58, 42], SLB: [69, 42],
    LCB: [10, 70], CB: [12, 70], NB: [50, 63], HUSKY: [50, 63], SS: [36, 81], FS: [64, 81], RCB: [90, 70],
  },
};

function fallbackPosition(index, total) {
  const columns = Math.min(4, total);
  return [14 + (index % columns) * 24, 18 + Math.floor(index / columns) * 25];
}

function CollegePlayerLine({ player, position, rosterPlayer, starter, onSelect }) {
  const recruiting = rosterPlayer?.recruiting;
  const currentAbility = rosterPlayer?.currentAbility;
  const recruitingLabel = `HS ${ratingLabel(recruiting)}`;
  const selected = {
    ...(rosterPlayer ?? {}),
    id: rosterPlayer?.id ?? `unmatched-${position}-${player.num}-${player.normalizedName}`,
    name: rosterPlayer?.name ?? player.name,
    position: rosterPlayer?.position ?? position,
    jerseyNumber: player.num || rosterPlayer?.jerseyNumber,
    classRank: player.classRank || rosterPlayer?.classRank,
    isTransfer: player.isTransfer,
  };

  return (
    <button
      className={`depth-player college-depth-player ${starter ? 'is-starter' : ''}`}
      type="button"
      onClick={() => onSelect(selected)}
      title={`View ${selected.name} recruiting profile`}
    >
      <span className="jersey-number">{player.num || '—'}</span>
      <span className="depth-player-copy">
        <strong className={selected.name.length > 17 ? 'long-player-name' : ''}>
          {selected.name}
          {recruiting?.stars === 5 && <span className="five-star" title={`On3 high-school recruiting: ${ratingLabel(recruiting)}`} aria-label={`On3 high-school recruiting: ${ratingLabel(recruiting)}`}>★</span>}
        </strong>
        <small>
          <span className="college-grade-label">{collegeGradeLabel(currentAbility)}</span>
          <span className="recruiting-hover-label">{recruitingLabel}</span>
        </small>
      </span>
      {player.isTransfer && <span className="transfer-chip">TR</span>}
    </button>
  );
}

export default function CollegeDepthChart({ chart, unit, playersById, customLayout, onPositionMove, onSelectPlayer }) {
  const fieldRef = useRef(null);
  const dragRef = useRef(null);
  const positions = Object.entries(chart ?? {});

  const finishDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || (event?.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
    dragRef.current = null;
    drag.element?.classList.remove('is-dragging');
    document.body.classList.remove('is-position-dragging');
    if (drag.handle?.hasPointerCapture?.(drag.pointerId)) drag.handle.releasePointerCapture(drag.pointerId);
    if (drag.coordinates) onPositionMove(drag.position, drag.coordinates);
  }, [onPositionMove]);

  useEffect(() => {
    window.addEventListener('blur', finishDrag);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('blur', finishDrag);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      finishDrag();
    };
  }, [finishDrag]);

  const moveDrag = (event) => {
    if (!dragRef.current || !fieldRef.current || event.pointerId !== dragRef.current.pointerId) return;
    event.preventDefault();
    const bounds = fieldRef.current.getBoundingClientRect();
    const coordinates = [
      Number(Math.max(10, Math.min(90, ((event.clientX - bounds.left) / bounds.width) * 100)).toFixed(2)),
      Number(Math.max(7, Math.min(93, ((event.clientY - bounds.top) / bounds.height) * 100)).toFixed(2)),
    ];
    dragRef.current.coordinates = coordinates;
    dragRef.current.element?.style.setProperty('--left', `${coordinates[0]}%`);
    dragRef.current.element?.style.setProperty('--top', `${coordinates[1]}%`);
  };

  const startDrag = (event, position) => {
    if (window.matchMedia('(max-width: 1100px)').matches || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const element = event.currentTarget.closest('.position-group');
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Global handlers still release the drag. */ }
    dragRef.current = { position, element, handle: event.currentTarget, pointerId: event.pointerId, coordinates: null };
    element?.classList.add('is-dragging');
    document.body.classList.add('is-position-dragging');
  };

  const moveWithKeyboard = (event, position, coordinates) => {
    const distance = event.shiftKey ? 5 : 1;
    const movement = {
      ArrowLeft: [-distance, 0], ArrowRight: [distance, 0], ArrowUp: [0, -distance], ArrowDown: [0, distance],
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    onPositionMove(position, [
      Math.max(10, Math.min(90, coordinates[0] + movement[0])),
      Math.max(7, Math.min(93, coordinates[1] + movement[1])),
    ]);
  };

  return (
    <section className={`field field-${unit}`} aria-label={`${unit} college depth chart`} ref={fieldRef}>
      <div className="field-markings" aria-hidden="true">
        <span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span>
      </div>
      <div className="formation">
        {positions.map(([position, players], index) => {
          const rawCoordinates = customLayout?.[position] ?? LAYOUT[unit]?.[position] ?? fallbackPosition(index, positions.length);
          const coordinates = [Math.max(10, Math.min(90, rawCoordinates[0])), rawCoordinates[1]];
          return (
            <article className="position-group" style={{ '--left': `${coordinates[0]}%`, '--top': `${coordinates[1]}%` }} key={position}>
              <button
                className="position-heading"
                type="button"
                aria-label={`Move ${position} position`}
                title="Drag to move · Arrow keys for fine adjustment"
                onPointerDown={(event) => startDrag(event, position)}
                onPointerMove={moveDrag}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onLostPointerCapture={finishDrag}
                onKeyDown={(event) => moveWithKeyboard(event, position, coordinates)}
              >
                <span>{position}</span>
                <small><span className="drag-glyph" aria-hidden="true">✥</span></small>
              </button>
              <div className="depth-stack">
                {players.map((player, playerIndex) => (
                  <CollegePlayerLine
                    key={`${player.num}-${player.normalizedName}`}
                    player={player}
                    position={position}
                    rosterPlayer={playersById.get(player.playerId)}
                    starter={playerIndex === 0}
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
