import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tap-to-act, long-press-for-info.
 *
 * The whole county screen runs on one convention, mirroring the original's
 * left-click-acts / right-click-informs split. Mobile has no right-click, so
 * long-press stands in for it. This lives in one hook because the convention
 * is load-bearing: if each component rolled its own timing or its own idea of
 * what counts as a press, the rule would hold in some places and not others,
 * and the player could never trust it.
 *
 * What it has to get right:
 *
 *  - A long-press must NOT also fire the tap. Otherwise asking for information
 *    about a field would change the field, which is exactly the accident the
 *    convention exists to prevent.
 *  - Sliding a finger is a scroll, not a press. Moving past a small threshold
 *    cancels, so scrolling the map never triggers anything.
 *  - Desktop gets right-click for info as well, because a user with a mouse
 *    should not have to hold it down.
 *  - The context menu must be suppressed on the element, or right-click and
 *    long-press both open the browser's menu over the panel.
 */

export const LONG_PRESS_MS = 450;
/** Finger travel past this many px means the user is scrolling, not pressing. */
const MOVE_CANCEL_PX = 10;

export interface LongPressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface UseLongPressOptions {
  /** Tap — performs the action. */
  onTap: () => void;
  /** Long-press or right-click — opens read-only information. */
  onInfo: () => void;
  disabled?: boolean;
}

export function useLongPress({ onTap, onInfo, disabled }: UseLongPressOptions): {
  handlers: LongPressHandlers;
  /** True while a press is being held — for the press-and-hold affordance. */
  holding: boolean;
} {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const firedInfo = useRef(false);
  const [holding, setHolding] = useState(false);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
    setHolding(false);
  }, []);

  // A press left hanging by an unmount would fire into a dead component.
  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // Right-click is the desktop equivalent of long-press; handle it on down
      // and do not start a press timer for it.
      if (e.button === 2) {
        firedInfo.current = true;
        onInfo();
        return;
      }
      firedInfo.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      setHolding(true);
      timer.current = window.setTimeout(() => {
        firedInfo.current = true;
        setHolding(false);
        onInfo();
      }, LONG_PRESS_MS);
    },
    [disabled, onInfo],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clear();
    },
    [clear],
  );

  const onPointerUp = useCallback(() => {
    if (disabled) return;
    const wasPending = timer.current !== null;
    clear();
    // Releasing before the timer fires is a tap. Releasing after it fired must
    // do nothing — the info panel is already open, and acting as well would
    // defeat the point of asking for information.
    if (wasPending && !firedInfo.current) onTap();
  }, [clear, disabled, onTap]);

  return {
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerMove,
      onPointerLeave: clear,
      onContextMenu: (e) => e.preventDefault(),
    },
    holding,
  };
}
