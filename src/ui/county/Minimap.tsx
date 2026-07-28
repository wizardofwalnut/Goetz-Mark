import type { CountyId } from '../../domain/ids';
import type { GameMap } from '../../domain/map/mapTypes';
import type { MatchState } from '../../domain/match/matchState';
import { palette, seatColor } from '../theme';

/**
 * The realm minimap.
 *
 * Shape and ownership, and nothing else. v2 corrects earlier drafts on this
 * directly: no buildings, no fields, no resource icons, no roads. At this size
 * detail is not information, it is noise — the minimap answers "who holds
 * what, and where is it" and hands off to the living map for everything else.
 *
 * Unclaimed land is GRASS-GREEN rather than grey. Grey reads as "no data";
 * unowned counties are not missing information, they are ordinary land nobody
 * has taken yet, and they should look like the land they are.
 */

/** Unclaimed county fill. Matches the look of unowned ground, not a null state. */
const UNCLAIMED = '#6f9a4e';

interface Props {
  readonly map: GameMap;
  readonly match: MatchState;
  /** Which county the living map is currently centred on. */
  readonly focus: CountyId;
  readonly width?: number;
}

export function Minimap({ map, match, focus, width = 108 }: Props) {
  const height = Math.round((width * map.height) / map.width);

  return (
    <svg
      className="mm"
      width={width}
      height={height}
      viewBox={`0 0 ${map.width} ${map.height}`}
      role="img"
      aria-label="Realm minimap"
    >
      <rect x="0" y="0" width={map.width} height={map.height} fill={palette.inkSoft} />
      {map.counties.map((county) => {
        const owner = match.counties[county.id]?.owner;
        const seat = owner ? match.players.find((p) => p.id === owner)?.seat : undefined;
        const fill = seat === undefined ? UNCLAIMED : seatColor(seat).base;
        const focused = county.id === focus;

        return (
          <polygon
            key={county.id}
            points={county.shape.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={fill}
            stroke={focused ? palette.parchment : palette.ink}
            strokeWidth={focused ? 16 : 8}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
