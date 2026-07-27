/* The Classic generator's design system.
 *
 * Lifted from the original page essentially verbatim — the same custom
 * properties, the same charcoal cards with chunky shadows, the same single
 * #4a84fa accent, the same pill switches, the same 900px column — because that
 * palette *is* the product's look and the revamp is meant to keep it.
 *
 * What is new here is layout and the accessibility work the inline version never
 * had:
 *
 *   - `.tool-grid` places the chat panel left and the Viewer Counter right on a
 *     desktop while leaving DOM order alone. Order is the mobile order (chat
 *     preview, counter preview, chat settings, counter settings), so a phone
 *     reaches the Counter without scrolling through 24 chat settings, and the
 *     desktop arrangement is grid placement rather than a second tree.
 *   - Focus is visible on every control, including the pill switches whose real
 *     checkbox is visually hidden — the ring is drawn on the slider from the
 *     input's :focus-visible.
 *   - A skip link, `.sr-only`, and reduced-motion handling.
 *
 * Kept as a string in a module rather than a global stylesheet because it is
 * scoped to this one route by being emitted with it, and because the original
 * page's `html, body` rules must not apply to the overlay routes.
 */

export const CLASSIC_GENERATOR_CSS = `
/* ── multichat design system ──
   ChatIS-v2 card language (charcoal cards, chunky shadows, pill toggles, one
   accent) with StreamNook polish: every section is a card, controls feel
   tactile, single accent #4a84fa used sparingly. Montserrat for UI. */
*, *::before, *::after { box-sizing: border-box; }
:root {
  --bg: #141418;
  --card: #1d1d23;
  --card-2: #24242c;
  --line: #2c2c35;
  --text: #e2e2e8;
  --muted: #9a9aa5;
  --dim: #62626e;
  --accent: #4a84fa;
  --accent-2: #6d9dff;
  --warn: #e0a34a;
  --err: #ee7777;
  --ok: #2fbf71;
  --shadow: 0 4px 24px rgba(0,0,0,.45), 0 1px 3px rgba(0,0,0,.5);
}
html, body {
  margin: 0; padding: 0; background: var(--bg); color: var(--text);
  font-family: 'Montserrat', 'Noto Sans JP', system-ui, sans-serif; font-size: 16px;
}
body { background-image: radial-gradient(ellipse 900px 420px at 50% -80px, rgba(74,132,250,0.09), transparent); }
a { color: var(--accent); text-decoration: none; transition: opacity .2s; }
a:hover { color: var(--accent-2); opacity: .85; }

/* The centred column. Wider than the original 900px because two tool panels sit
   side by side now; the panels themselves keep the original card proportions. */
.page { max-width: 1180px; margin: 0 auto; padding: 0 20px 60px; }

/* Focus, visible everywhere. The original page relied on the UA default, which
   several of its controls suppressed. */
:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.skip-link {
  position: absolute; left: -9999px; top: 0; z-index: 60;
  background: var(--card); color: var(--text); font-size: 0.9rem; font-weight: 700;
  padding: 10px 16px; border: 1px solid var(--accent); border-radius: 0 0 10px 0;
}
.skip-link:focus { left: 0; }
main:focus { outline: none; }

/* Header — compact horizontal strip, no giant hero */
header.header-strip { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 20px; padding: 10px 0 16px; margin-bottom: 18px; position: relative; }
.home-link { font-size: 0.82rem; color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 8px; transition: all .15s; }
.home-link:hover { color: var(--accent); background: rgba(74,132,250,.08); }
header.header-strip::after { content: ''; position: absolute; bottom: 0; left: 15%; right: 15%; height: 2px; background: linear-gradient(90deg, transparent, var(--accent), transparent); }
.header-logo { height: 150px; width: auto; margin: -20px 0 -30px; filter: drop-shadow(0 8px 20px rgba(0,0,0,.5)); }
.header-copy { display: flex; flex-direction: column; gap: 4px; }
.header-title { font-size: 2rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: -.04em; }
.header-sub { font-size: 0.9rem; font-weight: 600; color: var(--accent); margin: 0; }
.platform-row { display: flex; gap: 6px; margin-top: 2px; }
.platform-chip { font-size: 0.64rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; padding: 2px 10px; border-radius: 999px; background: rgba(255,255,255,0.03); }

/* Cards — every section is one */
.card {
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  padding: 20px 22px; margin-bottom: 22px; box-shadow: var(--shadow);
}
.card.hero { border-top: 2px solid var(--accent); padding: 26px 26px 20px; }
.section-title { font-size: 0.8rem; color: var(--accent); font-weight: 700; margin: 0 0 12px; text-transform: uppercase; letter-spacing: .12em; display: flex; align-items: center; gap: 8px; }
.section-title::before { content: ''; width: 4px; height: 14px; border-radius: 2px; background: var(--accent); }
.card-note { color: var(--dim); font-size: 0.78rem; margin: 8px 0 0; line-height: 1.55; }

/* ── The two-tool layout ──
   DOM order is the mobile order. On a desktop the four panels are placed into two
   columns so chat is left, the Counter is right, and both previews sit at the top
   — the Counter is visible without scrolling through the chat settings, which is
   the whole reason the settings are separate panels rather than one long card. */
.tool-grid { display: flex; flex-direction: column; }
@media (min-width: 1000px) {
  .tool-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'chat-output counter-output'
      'chat-settings counter-settings';
    gap: 0 22px;
    align-items: start;
  }
  .panel-chat-output { grid-area: chat-output; }
  .panel-counter-output { grid-area: counter-output; }
  .panel-chat-settings { grid-area: chat-settings; }
  .panel-counter-settings { grid-area: counter-settings; }
}

/* Platform inputs — compact row, one per platform */
.platform-inputs { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.platform-input { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; min-width: 190px; }
.platform-input input[type=text] { max-width: none; font-size: 0.92rem; padding: 9px 12px; width: 100%; }
.platform-tag { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; padding: 2px 10px; border-radius: 999px; }
.kick-tag { color: #53fc18; border: 1px solid rgba(83,252,24,.55); background: rgba(83,252,24,.06); }
.tw-tag { color: #a970ff; border: 1px solid rgba(145,70,255,.55); background: rgba(145,70,255,.07); }
.yt-tag { color: #ff5b5b; border: 1px solid rgba(255,68,68,.55); background: rgba(255,68,68,.06); }
.tt-tag { color: #25F4EE; border: 1px solid rgba(37,244,238,.5); background: rgba(37,244,238,.05); }
.platform-hint { text-align: center; color: var(--dim); font-size: 0.78rem; margin: -6px 0 4px; }

/* Two-column control table — the Classic arrangement */
.form_table { display: flex; gap: 0; margin-bottom: 4px; background: var(--card-2); border: 1px solid var(--line); border-radius: 10px; padding: 16px 4px 10px; }
.form_col { flex: 1; padding: 0 18px; min-width: 0; }
.form_col:first-child { border-right: 1px solid var(--line); }
.form_row { display: flex; align-items: center; margin-bottom: 11px; gap: 8px; }
.form_row.left { justify-content: flex-start; }
.col-heading { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); margin: 0 0 10px; }

input[type=text], input[type=number], select {
  background: #16161b; border: 1px solid var(--line); border-radius: 8px; color: var(--text);
  padding: 6px 11px; font-size: 0.86rem; font-family: inherit; outline: none;
  transition: border-color .15s, box-shadow .15s; max-width: 100%;
}
input[type=text]:focus, input[type=number]:focus, select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(74,132,250,.15); }
select option { background: var(--card); }
select option:disabled { color: var(--dim); }
input[type=text].short { width: 52px; }
label { font-size: 0.85rem; color: var(--muted); cursor: pointer; user-select: none; }

/* Catalog-driven control rows */
.classic-field { margin-bottom: 4px; }
.classic-field.stacked { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.classic-field.stacked label { font-size: 0.78rem; color: var(--dim); }
.classic-field.stacked input[type=text] { width: 100%; font-size: 0.8rem; }
.classic-help { font-size: 0.72rem; line-height: 1.45; color: var(--dim); margin: 2px 0 8px; }
.classic-help.warn { color: var(--warn); }

/* Pill toggles — the ChatIS signature control, scaled to our palette */
.toggle-wrap { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-bottom: 4px; }
.toggle-wrap > label:first-child { font-size: 0.85rem; color: var(--muted); cursor: pointer; user-select: none; order: -1; flex: 1; text-align: right; }
.toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; display: inline-block; }
.toggle input { position: absolute; opacity: 0; width: 44px; height: 24px; margin: 0; cursor: pointer; z-index: 1; }
.toggle-slider { position: absolute; inset: 0; background: #34343e; border-radius: 999px; cursor: pointer; transition: background .2s ease-in-out; }
.toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.4); transition: transform .2s ease-in-out; }
.toggle input:checked + .toggle-slider { background: var(--accent); }
.toggle input:checked + .toggle-slider::before { transform: translateX(20px); }
/* The real checkbox is transparent, so its focus ring has to be drawn on the
   slider — without this the switches are keyboard-reachable but invisible. */
.toggle input:focus-visible + .toggle-slider { outline: 2px solid var(--accent-2); outline-offset: 2px; }

/* Colour pair: a Transparent button that clears the value, beside a swatch */
.classic-color { display: inline-flex; align-items: center; gap: 6px; }
.classic-clear { font-size: 0.72rem; padding: 3px 9px; border-radius: 5px; cursor: pointer; font-family: inherit; border: 1px solid var(--line); background: #2e2e2e; color: var(--muted); }
.classic-clear.on { border-color: var(--accent); color: var(--accent); }
.classic-color input[type=color] { width: 30px; height: 24px; padding: 0; border: 1px solid var(--line); border-radius: 5px; background: none; cursor: pointer; }

/* Chip group — native checkboxes, chip-shaped labels */
.classic-chips { border: none; margin: 0; padding: 0; min-width: 0; }
.classic-chips legend { font-size: 0.85rem; color: var(--muted); padding: 0; margin-bottom: 6px; }
.classic-chip-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.classic-chip { display: inline-flex; }
.classic-chip input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.classic-chip-label {
  font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  padding: 4px 11px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--line); background: transparent; color: var(--dim);
}
.classic-chip-label.on { border-color: var(--accent); background: rgba(74,132,250,.14); color: var(--accent-2); }
.classic-chip-label[data-platform=kick].on { border-color: #53fc18; background: rgba(83,252,24,.14); color: #53fc18; }
.classic-chip-label[data-platform=twitch].on { border-color: #a970ff; background: rgba(145,70,255,.16); color: #a970ff; }
.classic-chip-label[data-platform=youtube].on { border-color: #ff5b5b; background: rgba(255,68,68,.14); color: #ff5b5b; }
.classic-chip-label[data-platform=tiktok].on { border-color: #25F4EE; background: rgba(37,244,238,.12); color: #25F4EE; }
.classic-chip input:disabled + .classic-chip-label { opacity: .45; cursor: not-allowed; }
.classic-chip input:focus-visible + .classic-chip-label { outline: 2px solid var(--accent-2); outline-offset: 2px; }

/* Twitch connection, inline in its platform field */
.classic-conn { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; margin-top: 2px; }
.classic-connect {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  border: 1px solid rgba(145,70,255,.45); background: rgba(145,70,255,.07); color: #a970ff;
}
.classic-connect:hover { background: rgba(145,70,255,.15); color: #bb8dff; opacity: 1; }
.classic-conn-who { font-size: 0.72rem; color: #77aaee; font-weight: 600; }
.classic-conn-warn { font-size: 0.7rem; color: var(--warn); flex-basis: 100%; text-align: center; }
.classic-conn-err { font-size: 0.7rem; color: var(--err); flex-basis: 100%; text-align: center; }
.classic-conn-btn {
  font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  padding: 4px 9px; border-radius: 6px; cursor: pointer; font-family: inherit;
  border: 1px solid rgba(255,255,255,.18); background: transparent; color: #9aa;
}
.classic-conn-btn:hover { border-color: var(--accent); color: var(--accent); }
.classic-conn-btn:disabled { color: var(--dim); cursor: default; }

/* Preview surfaces */
.preview-label { font-size: 0.75rem; color: var(--dim); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
.preview-label button { background: none; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); font-size: 0.72rem; padding: 3px 9px; cursor: pointer; transition: all .15s; text-transform: none; letter-spacing: 0; font-weight: 600; font-family: inherit; }
.preview-label button:hover { border-color: var(--accent); color: var(--accent); }
.preview-surface { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; box-shadow: inset 0 2px 12px rgba(0,0,0,.3); min-height: 90px; }
.preview-surface.white { background: #46464e; }
.preview-surface.checkered { background: repeating-conic-gradient(#1a1a20 0% 25%, #131318 0% 50%) 0 0 / 16px 16px; }
.preview-empty { display: flex; align-items: center; justify-content: center; padding: 26px 16px; color: var(--dim); font-size: 0.78rem; text-align: center; line-height: 1.5; }

/* URL result */
.url-box { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; margin-top: 12px; }
.url-code { flex: 1 1 240px; min-width: 0; background: #101014; border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; font-family: 'Roboto Mono', monospace; font-size: 0.7rem; color: var(--accent); word-break: break-all; line-height: 1.7; }
.url-copy { flex-shrink: 0; background: var(--accent); color: #fff; border: none; border-radius: 8px; font-weight: 800; font-size: 0.83rem; padding: 10px 20px; cursor: pointer; transition: background .15s; font-family: inherit; }
.url-copy:hover { background: var(--accent-2); }
.url-copy.ok { background: var(--ok); }
.url-open { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 0.83rem; font-weight: 800; padding: 10px 18px; border-radius: 8px; background: transparent; border: 1px solid rgba(74,132,250,.5); color: var(--accent); }
.url-open:hover { background: rgba(74,132,250,.1); }
.url-warn { flex-basis: 100%; font-size: 0.74rem; color: var(--warn); line-height: 1.5; margin: 0; }

/* Commands table */
.cmd-table { width: 100%; border-collapse: collapse; font-size: 0.79rem; }
.cmd-table th { text-align: left; color: var(--dim); font-weight: 700; text-transform: uppercase; font-size: 0.68rem; letter-spacing: .08em; padding: 4px 10px 8px; border-bottom: 1px solid var(--line); }
.cmd-table td { padding: 7px 10px; color: var(--muted); border-bottom: 1px solid rgba(44,44,53,.5); vertical-align: top; line-height: 1.45; }
.cmd-table td:first-child { color: var(--accent); font-family: 'Roboto Mono', monospace; white-space: nowrap; font-size: 0.72rem; }
.cmd-table tr:last-child td { border-bottom: none; }
.cmd-table-wrap { overflow-x: auto; }

/* Setup steps */
.steps { list-style: none; padding: 0; margin: 0 0 14px; counter-reset: s; }
.steps li { counter-increment: s; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; font-size: 0.86rem; color: var(--muted); line-height: 1.55; }
.steps li::before { content: counter(s); background: rgba(74,132,250,.12); border: 1px solid rgba(74,132,250,.4); border-radius: 50%; min-width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: var(--accent); flex-shrink: 0; margin-top: 1px; }
.steps li strong { color: var(--text); }
.setup-sub { font-size: 0.8rem; font-weight: 800; color: var(--text); margin: 16px 0 8px; }

/* Footer */
footer { border-top: 1px solid var(--line); padding: 22px 0; text-align: center; font-size: 0.78rem; color: var(--dim); margin-top: 24px; }
footer p { margin: 4px 0; }
footer a { color: var(--accent); }

/* Tablet and narrow desktop: one column, so two unusably narrow panels never
   happen. The control table stacks at the same breakpoint the original used. */
@media (max-width: 720px) {
  .form_table { flex-direction: column; padding: 16px 14px 10px; }
  .form_col { padding: 0; }
  .form_col:first-child { border-right: none; border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 14px; }
  .header-logo { height: 200px; margin: -24px 0 -54px; }
  .header-strip { gap: 12px; flex-wrap: wrap; }
  .header-title { font-size: 1.6rem; }
  .page { padding: 0 14px 48px; }
  .card { padding: 16px 15px; border-radius: 12px; }
  .card.hero { padding: 18px 15px 16px; }
  .platform-input { min-width: 100%; }
  /* Touch targets: the chips and small buttons are the only controls that fall
     under a comfortable tap size at these sizes. */
  .classic-chip-label { padding: 8px 14px; font-size: 0.7rem; }
  .classic-conn-btn, .classic-clear { padding: 8px 12px; }
  .url-copy, .url-open { flex: 1 1 auto; padding: 12px 16px; }
  .toggle-wrap { margin-bottom: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;
