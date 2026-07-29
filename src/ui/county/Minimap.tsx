import type { CountyId } from '../../domain/ids';
import type { GameMap } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import { palette, seatColor } from '../theme';

/**
 * The realm minimap — and the way you travel.
 *
 * Shape and ownership, and nothing else. v2 corrects earlier drafts on this
 * directly: no buildings, no fields, no resource icons, no roads. At this size
 * detail is not information, it is noise — the minimap answers "who holds what,
 * and where is it" and hands off to the living map for everything else.
 *
 * It now has a second job. The living map is one continuous scrollable world,
 * so the minimap is how you cross it without dragging: tap a county and the
 * camera goes to its town centre. That makes the viewport rectangle worth
 * drawing too — once the map scrolls, "where am I looking?" is a real question.
 *
 * Unclaimed land is GRASS-GREEN rather than grey. Grey reads as "no data";
 * unowned counties are not missing information, they are ordinary land nobody
 * has taken yet, and they should look like the land they are.
 */

/** Unclaimed county fill. Matches the look of unowned ground, not a null state. */
const UNCLAIMED = '#6f9a4e';

/** The camera's rectangle, in world cell units. */
export interface ViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly worldCols: number;
  readonly worldRows: number;
}

interface Props {
  readonly map: GameMap;
  readonly match: MatchState;
  /** Which county the living map is currently centred on. */
  readonly focus: CountyId | null;
  readonly onFocus?: (id: CountyId) => void;
  readonly viewport?: ViewportRect | null;
  /**
   * The tiled world's height ÷ width, in rendered pixels.
   *
   * Passed in rather than guessed from the plot grid: counties are far taller
   * than they are wide, so a 2×2 realm is nothing like a square and a minimap
   * that drew it as one would misrepresent every distance on it.
   */
  readonly aspect?: number;
  /** Largest the minimap may be, in CSS pixels. It fits INSIDE this box. */
  readonly width?: number;
  readonly maxHeight?: number;
}

export function Minimap({
  map,
  match,
  focus,
  onFocus,
  viewport,
  aspect,
  width = 108,
  maxHeight = 148,
}: Props) {
  const plotted = map.counties.every((c) => c.plot !== undefined);
  return plotted ? (
    <TiledMinimap {...{ map, match, focus, onFocus, viewport, aspect, width, maxHeight }} />
  ) : (
    <ShapeMinimap {...{ map, match, focus, onFocus, width }} />
  );
}

/**
 * Fit the world into the corner box.
 *
 * Sizing by width alone was wrong the moment the map became a tall world: a
 * realm twice as tall as it is wide came out 108x211, which on a phone is not a
 * minimap, it is a panel covering a quarter of the land. The box is a BUDGET —
 * whichever axis runs out first decides the scale.
 */
export function fitMinimap(width: number, maxHeight: number, aspect: number) {
  const height = width * aspect;
  return height <= maxHeight
    ? { width: Math.round(width), height: Math.round(height) }
    : { width: Math.round(maxHeight / aspect), height: Math.round(maxHeight) };
}

const fillFor = (match: MatchState, id: CountyId) => {
  const owner = match.counties[id]?.owner;
  const seat = owner ? match.players.find((p) => p.id === owner)?.seat : undefined;
  return seat === undefined ? UNCLAIMED : seatColor(seat).base;
};

/**
 * The tiled world, drawn as what it actually is.
 *
 * The counties used to be drawn from their jittered map polygons. Those
 * described a world that no longer exists: the living map tiles interiors into
 * a strictly rectangular grid, so a wobbly outline misrepresented both the
 * shape of the world and — now that the minimap is tappable — where a tap
 * lands. One cell per county, in plot coordinates.
 */
function TiledMinimap({
  map,
  match,
  focus,
  onFocus,
  viewport,
  aspect,
  width,
  maxHeight,
}: Required<Pick<Props, 'map' | 'match' | 'width' | 'maxHeight'>> &
  Pick<Props, 'focus' | 'onFocus' | 'viewport' | 'aspect'>) {
  const cols = Math.max(...map.counties.map((c) => c.plot!.col)) + 1;
  const rows = Math.max(...map.counties.map((c) => c.plot!.row)) + 1;

  // A county is much taller than it is wide, so the world's real proportions
  // come from the caller. Falling back to the plot grid keeps it drawable
  // before the surface has been measured.
  const box = fitMinimap(width, maxHeight, aspect ?? rows / cols);

  // One viewBox unit per county, with `preserveAspectRatio: none` stretching
  // them to the real proportions. That keeps every coordinate in this component
  // in plot units, which is the only unit the counties are actually placed in.
  const cellW = cols;
  const cellH = rows;

  return (
    <svg
      className="mm"
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${cellW} ${cellH}`}
      preserveAspectRatio="none"
      role="group"
      aria-label="Realm minimap"
    >
      <rect x="0" y="0" width={cellW} height={cellH} fill={palette.inkSoft} />
      {map.counties.map((county) => {
        const { col, row } = county.plot!;
        const focused = county.id === focus;
        return (
          <rect
            key={county.id}
            x={col}
            y={row}
            width={1}
            height={1}
            fill={fillFor(match, county.id)}
            stroke={focused ? palette.parchment : palette.ink}
            // Non-scaling, because the viewBox is stretched non-uniformly to
            // reach the world's proportions — a plain stroke would come out
            // thick on one axis and hairline on the other.
            vectorEffect="non-scaling-stroke"
            strokeWidth={focused ? 3 : 1}
            role={onFocus ? 'button' : undefined}
            tabIndex={onFocus ? 0 : undefined}
            style={onFocus ? { cursor: 'pointer' } : undefined}
            onClick={onFocus ? () => onFocus(county.id) : undefined}
            onKeyDown={
              onFocus
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') onFocus(county.id);
                  }
                : undefined
            }
          >
            <title>{county.name}</title>
          </rect>
        );
      })}

      {/* Where the camera is. Drawn last so it is never hidden by a county. */}
      {viewport && (
        <rect
          x={(viewport.x / viewport.worldCols) * cellW}
          y={(viewport.y / viewport.worldRows) * cellH}
          width={Math.min(cellW, (viewport.width / viewport.worldCols) * cellW)}
          height={Math.min(cellH, (viewport.height / viewport.worldRows) * cellH)}
          fill="none"
          stroke={palette.parchment}
          vectorEffect="non-scaling-stroke"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

/**
 * The polygon fallback, for maps that are not grids.
 *
 * A map pack of irregular shires has no plot to tile, so it keeps the original
 * drawing. Kept rather than deleted because the tiled world is a property of
 * THIS map, not of every map the game will ever load.
 */
function ShapeMinimap({
  map,
  match,
  focus,
  onFocus,
  width,
}: Required<Pick<Props, 'map' | 'match' | 'width'>> & Pick<Props, 'focus' | 'onFocus'>) {
  const height = Math.round((width * map.height) / map.width);

  return (
    <svg
      className="mm"
      width={width}
      height={height}
      viewBox={`0 0 ${map.width} ${map.height}`}
      role="group"
      aria-label="Realm minimap"
    >
      <rect x="0" y="0" width={map.width} height={map.height} fill={palette.inkSoft} />
      {map.counties.map((county) => {
        const focused = county.id === focus;
        return (
          <polygon
            key={county.id}
            points={county.shape.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={fillFor(match, county.id)}
            stroke={focused ? palette.parchment : palette.ink}
            strokeWidth={focused ? 16 : 8}
            strokeLinejoin="round"
            role={onFocus ? 'button' : undefined}
            tabIndex={onFocus ? 0 : undefined}
            style={onFocus ? { cursor: 'pointer' } : undefined}
            onClick={onFocus ? () => onFocus(county.id) : undefined}
          >
            <title>{county.name}</title>
          </polygon>
        );
      })}
    </svg>
  );
}
