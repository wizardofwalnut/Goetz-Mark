/**
 * Read-only information sheet.
 *
 * Everything reached by long-press lands here, and this component deliberately
 * offers NO actions. That is the whole contract of the convention: a player who
 * asks what something is must never be one stray tap from changing it. The
 * moment an edit control appears in here, long-press stops being safe and the
 * convention is worth nothing.
 */

export interface InfoContent {
  readonly title: string;
  /** Label/value pairs. */
  readonly lines: readonly (readonly [string, string])[];
  readonly note?: string;
}

export function InfoSheet({
  content,
  onClose,
}: {
  content: InfoContent;
  onClose: () => void;
}) {
  return (
    <div className="cs-sheet-backdrop" onClick={onClose}>
      <div className="cs-sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="cs-sheet-title">{content.title}</div>

        {content.lines.length > 0 && (
          <dl className="cs-info-grid">
            {content.lines.map(([label, value]) => (
              <div key={label} className="cs-info-row">
                <dt className="stat-label">{label}</dt>
                <dd className="cs-info-value">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {content.note && <p className="note">{content.note}</p>}

        <button className="chip cs-sheet-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
