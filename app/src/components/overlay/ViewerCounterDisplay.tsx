/* ViewerCounterDisplay — the single viewer-counter renderer.
 *
 * Used by both the standalone /counter overlay and the generator preview,
 * so the two cannot drift apart. It is presentation-only: it receives
 * per-platform statuses and a style config and renders them. It never
 * fetches, polls, or knows where the numbers came from.
 *
 * Layout is intrinsic (inline-flex pills, no fixed width) so it adapts to
 * any OBS browser-source size. It sets no page background or margin —
 * transparency is the host page's concern.
 */
import { useEffect, useRef, useState } from 'react';
import {
  googleFontValue,
  normalizeGoogleFontFamily,
  overlayFontUrl,
} from '../../lib/overlayFonts';
import {
  COUNTER_FONT_FAMILY,
  COUNTER_FONT_SIZE_PX,
  COUNTER_FONT_WEIGHT,
  PLATFORM_ORDER,
  summarize,
  visiblePlatforms,
  type PlatformStatuses,
  type ViewerCounterStyle,
  type ViewerPlatform,
} from '../../lib/viewerCounterConfig';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** Shown when a platform is live but its count is not determinable. */
const UNAVAILABLE_MARK = '—';

/** Duration of the rolling-number animation. */
const ROLL_DURATION_MS = 600;

/*
 * Size and weight stay fixed so the counter's geometry remains stable. The
 * family defaults to DejaVu Sans and may be replaced by the counter's own
 * explicitly selected Google Fonts family; it never inherits MultiChat's font.
 */
const FONT_SIZE = COUNTER_FONT_SIZE_PX;

/** Every other dimension is derived from the fixed size. */
const ICON_SIZE = Math.round(FONT_SIZE * 0.9);
const GAP_INNER = Math.round(FONT_SIZE * 0.28);
const GAP_OUTER = Math.round(FONT_SIZE * 0.5);
const PAD_Y = Math.round(FONT_SIZE * 0.22);
const PAD_X = Math.round(FONT_SIZE * 0.5);

/**
 * Default font and entrance-animation rules, emitted by the shared renderer so
 * the standalone overlay and the generator preview always get the same baseline.
 * A validated custom Google family is imported ahead of this block at render
 * time and applied to the pill inline, keeping legacy/default URLs network-free.
 */
const FONT_CSS = `
@font-face { font-family: 'DejaVu Sans'; src: url('/fonts/DejaVuSans-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@keyframes vcIn { from { opacity: 0; transform: translateX(-8px) scale(0.85); } to { opacity: 1; transform: none; } }
`;

const ICONS: Record<ViewerPlatform, JSX.Element> = {
  // Kick's blocky K reads denser than the other marks — render it slightly
  // smaller inside its box so all icons appear the same size.
  kick: (
    <svg viewBox="0 0 24 24" fill="#53FC19" style={{ height: '78%', width: 'auto', margin: 'auto' }}>
      <path d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z" />
    </svg>
  ),
  twitch: <img src="/platform-twitch.png" alt="" style={{ height: '100%', width: 'auto' }} />,
  youtube: (
    <svg viewBox="0 0 24 24" style={{ height: '100%', width: 'auto' }}>
      <path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
      <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12z" />
    </svg>
  ),
  tiktok: <img src="/platform-tiktok.png" alt="" style={{ height: '100%', width: 'auto' }} />,
};

/* ------------------------------------------------------------------ */
/* Rolling number                                                      */
/* ------------------------------------------------------------------ */

/**
 * Eases from the previous value to the next over {@link ROLL_DURATION_MS}.
 *
 * The effect depends only on `value`, so restyling (shadow, stroke,
 * alignment, font) never restarts an animation.
 */
function RollingCount({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / ROLL_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span style={{ fontSize: FONT_SIZE, fontVariantNumeric: 'tabular-nums' }}>
      {shown.toLocaleString()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export type ViewerCounterDisplayProps = {
  statuses: PlatformStatuses;
  style: ViewerCounterStyle;
};

export default function ViewerCounterDisplay({
  statuses,
  style,
}: ViewerCounterDisplayProps) {
  /* Shadow and stroke come only from the counter's own style config, never
     from MultiChat's state, so restyling chat cannot change an already
     generated counter URL. */
  const shadow =
    style.textShadow === 'small' ? 'drop-shadow(2px 2px 0.2rem black)' :
    style.textShadow === 'medium' ? 'drop-shadow(2px 2px 0.35rem black)' :
    style.textShadow === 'large' ? 'drop-shadow(2px 2px 0.5rem black)' : '';

  const strokeCss = ({
    thin: '1px black',
    medium: '2px black',
    thick: '3px black',
    thicker: '4px black',
  } as Record<string, string>)[style.stroke] ?? '';

  /* Defense in depth: style normally arrives through the shared normalizer, but
     the renderer validates again so a direct caller can never inject CSS. */
  const googleFamily = normalizeGoogleFontFamily(style.googleFont);
  const googleValue = googleFontValue(googleFamily);
  const googleUrl = overlayFontUrl(googleValue ?? undefined);
  const fontFamily = googleFamily
    ? `'${googleFamily}', ${COUNTER_FONT_FAMILY}`
    : COUNTER_FONT_FAMILY;
  const rendererCss = googleUrl
    ? `@import url('${googleUrl}');\n${FONT_CSS}`
    : FONT_CSS;

  const pill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: GAP_INNER,
    ...(style.bg
      ? {
          background: 'rgba(20,20,24,0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderRadius: 999,
          padding: `${PAD_Y}px ${PAD_X}px`,
        }
      : {}),
    fontFamily,
    fontWeight: COUNTER_FONT_WEIGHT,
    color: '#fff',
    ...(shadow ? { filter: shadow } : {}),
    ...(strokeCss ? { WebkitTextStroke: strokeCss } : {}),
    transition: 'all 400ms ease',
  };

  const iconBox = (platform: ViewerPlatform) => (
    <span
      key={`icon-${platform}`}
      style={{
        height: ICON_SIZE,
        width: ICON_SIZE,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'vcIn 400ms ease',
      }}
    >
      {ICONS[platform]}
    </span>
  );

  const unavailableNode = (
    <span style={{ fontSize: FONT_SIZE, fontVariantNumeric: 'tabular-nums' }}>
      {UNAVAILABLE_MARK}
    </span>
  );

  const justify =
    style.align === 'center' ? 'center' : style.align === 'right' ? 'flex-end' : 'flex-start';

  const visible = visiblePlatforms(statuses);
  const summary = summarize(statuses);

  /* Nothing configured yet, or every platform confirmed offline: render
     nothing at all rather than a fabricated zero. */
  const showCombined = style.combined && summary.hasPresence;

  return (
    <>
      <style>{rendererCss}</style>
    <div
      style={{
        display: 'flex',
        gap: GAP_OUTER,
        flexWrap: 'wrap',
        justifyContent: justify,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {style.combined
        ? showCombined && (
            <div style={pill}>
              {style.icons && visible.map(iconBox)}
              {summary.hasMeasured ? (
                <RollingCount value={summary.total} />
              ) : (
                unavailableNode
              )}
            </div>
          )
        : PLATFORM_ORDER.filter((platform) => {
            const status = statuses[platform];
            return status?.state === 'live' || status?.state === 'live-unknown';
          }).map((platform) => {
            const status = statuses[platform]!;
            return (
              <div key={platform} style={pill}>
                {style.icons && iconBox(platform)}
                {status.state === 'live' ? (
                  <RollingCount value={status.viewers} />
                ) : (
                  unavailableNode
                )}
              </div>
            );
          })}
    </div>
    </>
  );
}
