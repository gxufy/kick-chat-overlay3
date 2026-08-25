/* The live Viewer Counter simulation controls, inside the Viewer counter card.
 *
 * Preview controls, exactly like the chat feed's: they change what the preview
 * shows and nothing else. Nothing here is serialized into the counter URL,
 * written to the saved draft, or sent to /api/viewers — and none of it touches
 * the six counter settings, which remain the authority on how a count is drawn.
 *
 * WHY THE MANUAL FIELDS MOVED. Four always-visible number inputs dominated a card
 * whose subject is the preview above them, and with the rotation running they are
 * no longer the primary way to see anything: the simulation reaches every
 * platform combination on its own, including the states a person used to have to
 * type by hand. They are still here — clearing a field is the only way to see the
 * uncountable presentation on demand — but folded into a closed `<details>` so the
 * card leads with the preview and its run state.
 *
 * The fields keep their ids, their labels and their Restore button verbatim: a
 * `<details>` hides its contents from view without removing them from the
 * document, so everything that referenced them still does.
 */
import { PLATFORM_ORDER, type ViewerPlatform } from '@/lib/viewerCounterConfig';
import { PREVIEW_SPEEDS, type PreviewSpeed } from '@/lib/tools/previewRandom';
import { COUNTER_COUNT_MAX } from '@/features/counter/samples';
import { COUNTER_STATE_COUNT, type CounterPreviewMode } from './useCounterPreviewSimulator';

/** Visible names for the three speeds, in the order the band widens. */
const SPEED_LABEL: Record<PreviewSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
};

export default function ClassicCounterFeedControls({
  enabled,
  paused,
  speed,
  mode,
  running,
  seenCount,
  combinationLabel,
  counts,
  platformLabel,
  onEnabledChange,
  onTogglePaused,
  onSpeedChange,
  onAdvance,
  onRestore,
  onCountChange,
  onRestoreCounts,
}: {
  enabled: boolean;
  paused: boolean;
  speed: PreviewSpeed;
  mode: CounterPreviewMode;
  /** True while a change is actually scheduled. False when the tab is hidden. */
  running: boolean;
  /** How many of the sixteen states this run has shown at least once. */
  seenCount: number;
  /** The combination on screen, already worded. Empty before the first change. */
  combinationLabel: string;
  /** The manual fields, as typed. Strings, because "" is a meaningful value. */
  counts: Record<ViewerPlatform, string>;
  platformLabel: Readonly<Partial<Record<ViewerPlatform, string>>>;
  onEnabledChange: (next: boolean) => void;
  onTogglePaused: () => void;
  onSpeedChange: (next: PreviewSpeed) => void;
  onAdvance: () => void;
  onRestore: () => void;
  onCountChange: (platform: ViewerPlatform, raw: string) => void;
  onRestoreCounts: () => void;
}) {
  const manual = mode === 'manual';

  return (
    <div className="preview-feed preview-counter-feed">
      <div className="preview-feed-row">
        <div className="toggle-wrap">
          <label htmlFor="counter-sim-enabled">Live counter simulation</label>
          <span className="toggle">
            <input
              id="counter-sim-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
            />
            <span className="toggle-slider" aria-hidden="true" />
          </span>
        </div>

        <button
          type="button"
          className="classic-conn-btn"
          onClick={onTogglePaused}
          disabled={!enabled || manual}
          aria-pressed={paused}
        >
          {paused ? 'Resume simulation' : 'Pause simulation'}
        </button>

        {/* Enabled even while paused or in manual mode: stepping by hand is how
            someone inspects one combination without waiting for the rotation, and
            refusing it in exactly the states where waiting is not an option would
            be the wrong way round. */}
        <button type="button" className="classic-conn-btn" onClick={onAdvance}>
          Next combination
        </button>

        <button type="button" className="classic-conn-btn" onClick={onRestore}>
          Restore simulation
        </button>
      </div>

      <fieldset className="classic-seg preview-feed-seg">
        <legend>Simulation speed</legend>
        <div className="classic-seg-row">
          {PREVIEW_SPEEDS.map((option) => (
            <span className="classic-seg-item" key={option}>
              <input
                type="radio"
                id={`counter-sim-speed-${option}`}
                name="counter-sim-speed"
                value={option}
                checked={speed === option}
                onChange={() => onSpeedChange(option)}
              />
              <label
                htmlFor={`counter-sim-speed-${option}`}
                className={`classic-seg-label${speed === option ? ' on' : ''}`}
              >
                {SPEED_LABEL[option]}
              </label>
            </span>
          ))}
        </div>
      </fieldset>

      {/* Closed by default. Open it and the fields are exactly the ones that were
          always on screen before, in the same order with the same labels. */}
      <details className="preview-manual">
        <summary>Manual preview values</summary>
        <fieldset className="preview-counts-fields">
          <legend>Preview counts</legend>
          {PLATFORM_ORDER.map((platform) => (
            <span key={platform} className="preview-counts-field">
              <label htmlFor={`sample-count-${platform}`}>
                {platformLabel[platform] ?? platform}
              </label>
              <input
                id={`sample-count-${platform}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={String(COUNTER_COUNT_MAX).length}
                value={counts[platform]}
                onChange={(e) => onCountChange(platform, e.target.value)}
              />
            </span>
          ))}
        </fieldset>
        <div className="preview-counts-actions">
          <button type="button" className="classic-conn-btn" onClick={onRestoreCounts}>
            Restore sample counts
          </button>
          <p className="classic-help">
            Sample values only — never fetched, never saved, and never part of the
            URL below. Typing here holds the rotation still; clear a field to see
            how an uncountable platform looks. Restore simulation resumes it.
          </p>
        </div>
      </details>

      {/* One live region for the rotation, and deliberately not one per change:
          announcing sixteen combinations as they cycle would make the page
          unusable with a screen reader. It states the run state and the coverage,
          which is what changes meaningfully, and it is polite so it waits for a
          pause in speech. */}
      <p className="preview-feed-status" role="status">
        {manual
          ? 'Manual preview values in use. Simulation held.'
          : !enabled
            ? 'Live counter simulation off.'
            : paused
              ? `Live counter simulation paused. Showing ${combinationLabel || 'the sample counts'}.`
              : running
                ? `Live counter simulation running. ${seenCount} of ${COUNTER_STATE_COUNT} platform combinations shown.`
                : 'Live counter simulation paused while the tab is in the background.'}
      </p>
    </div>
  );
}
