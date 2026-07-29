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
 *   - `.tool-grid` places the two tools into a column each on a desktop — outputs
 *     aligned in row one, each settings card beneath its own output in row two —
 *     while leaving DOM order alone. Order is the stacked order (chat output, chat
 *     settings, counter output, counter settings), so a phone reads each tool as a
 *     unit and the desktop arrangement is named grid areas rather than a second
 *     tree.
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
   side by side now; the panels themselves keep the original card proportions.

   1500px with a 32px gutter: at 1920 that leaves ~210px of background either
   side, which reads as a deliberately bounded page rather than the wide empty
   gutters the 1180px column produced, and it stops well short of edge-to-edge.
   The gutter is what holds the bound at intermediate widths — between about 1530
   and 1560 the max-width stops binding and the padding takes over, so the page
   never touches the viewport edge. */
.page { max-width: 1500px; margin: 0 auto; padding: 0 32px 44px; }

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

/* Cards — every section is one. Padding and margins are tighter than the
   original: the page is now four panels plus two full-width sections rather than
   one column, so per-card padding is paid six times over and was pushing the
   commands and setup cards below two screens on a 1080p display. */
.card {
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  padding: 14px 16px; margin-bottom: 14px; box-shadow: var(--shadow);
}
.card.hero { border-top: 2px solid var(--accent); padding: 16px 18px 12px; }
.section-title { font-size: 0.8rem; color: var(--accent); font-weight: 700; margin: 0 0 9px; text-transform: uppercase; letter-spacing: .12em; display: flex; align-items: center; gap: 8px; }
.section-title::before { content: ''; width: 4px; height: 14px; border-radius: 2px; background: var(--accent); }
.card-note { color: var(--dim); font-size: 0.76rem; margin: 6px 0 0; line-height: 1.45; }

/* ── The two-tool layout ──
   One grid holding both tools and the two full-width sections. DOM order is the
   stacked order — chat output, chat settings, counter output, counter settings,
   commands, setup — so the phone layout is this tree unchanged, with no media
   query needed for it and no control duplicated per breakpoint.

   The desktop arrangement is named areas over that same tree: the two outputs
   share row 1 so the previews stay aligned beside each other, and each settings
   card sits directly beneath its own output in row 2. Rows 3 and 4 span both
   columns. Because this is placement only, reading and tab order stay per tool
   (output then its settings) at every width. */
.tool-grid { display: flex; flex-direction: column; }
@media (min-width: 1000px) {
  .tool-grid {
    display: grid;
    /* An even split: the outputs must align beside each other, so neither tool
       can claim a wider track than the other. Both minmax(0,…) so a long
       unbroken URL cannot push a column past its track. */
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      "chat-output   counter-output"
      "chat-settings counter-settings"
      "commands      commands"
      "obs           obs";
    gap: 0 16px;
    align-items: start;
  }
  .panel-chat-output { grid-area: chat-output; }
  .panel-counter-output { grid-area: counter-output; }
  .panel-chat-settings { grid-area: chat-settings; }
  .panel-counter-settings { grid-area: counter-settings; }
  .panel-commands { grid-area: commands; }
  .panel-obs { grid-area: obs; }
}

/* Platform inputs — compact row, one per platform */
.platform-inputs { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.platform-input { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-width: 190px; }
.platform-input input[type=text] { max-width: none; font-size: 0.9rem; padding: 8px 12px; width: 100%; }
.platform-tag { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; padding: 2px 10px; border-radius: 999px; }
.kick-tag { color: #53fc18; border: 1px solid rgba(83,252,24,.55); background: rgba(83,252,24,.06); }
.tw-tag { color: #a970ff; border: 1px solid rgba(145,70,255,.55); background: rgba(145,70,255,.07); }
.yt-tag { color: #ff5b5b; border: 1px solid rgba(255,68,68,.55); background: rgba(255,68,68,.06); }
.tt-tag { color: #25F4EE; border: 1px solid rgba(37,244,238,.5); background: rgba(37,244,238,.05); }
.platform-hint { text-align: center; color: var(--dim); font-size: 0.76rem; margin: -2px 0 2px; }

/* Multi-column control table — the Classic arrangement, tightened.
   Grid rather than flex so a third column can be added by class alone, and so
   the dividers fall between columns without a :first-child rule per count. */
.form_table {
  display: grid; grid-template-columns: 1fr; gap: 0 14px; margin-bottom: 4px;
  background: var(--card-2); border: 1px solid var(--line); border-radius: 10px;
  padding: 11px 14px 7px;
}
.form_col { min-width: 0; }
.form_row { display: flex; align-items: center; margin-bottom: 7px; gap: 8px; }
.form_row.left { justify-content: flex-start; }
.col-heading { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); margin: 0 0 7px; }

/* Column counts, applied only where there is room for them. Every table is a
   single column below the breakpoint, which is what keeps the stacked reading
   order equal to the DOM order — the columns are grid tracks over one unchanged
   tree, so no control is duplicated for a breakpoint.

   1360px, not 1000px: a settings panel is now half of a tool row rather than the
   page's full width, so two tracks only become usable once the row itself is wide.
   Splitting a 390px half into two 180px columns is worse than one readable column,
   which is the failure this breakpoint exists to avoid. */
@media (min-width: 1360px) {
  .form_table.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .form_table.cols-2 > .form_col:not(:last-child) { border-right: 1px solid var(--line); padding-right: 14px; }
}

/* textarea is listed here rather than left to the browser: without it the one
   multiline field on the page renders as a white serif box on a dark card. */
input[type=text], input[type=number], select, textarea {
  background: #16161b; border: 1px solid var(--line); border-radius: 8px; color: var(--text);
  padding: 6px 11px; font-size: 0.86rem; font-family: inherit; outline: none;
  transition: border-color .15s, box-shadow .15s; max-width: 100%;
}
input[type=text]:focus, input[type=number]:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(74,132,250,.15); }
select option { background: var(--card); }
select option:disabled { color: var(--dim); }
input[type=text].short { width: 52px; }
label { font-size: 0.85rem; color: var(--muted); cursor: pointer; user-select: none; }

/* Catalog-driven control rows */
.classic-field { margin-bottom: 2px; }
.classic-field.stacked { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
.classic-field.stacked label { font-size: 0.77rem; color: var(--dim); }
.classic-field.stacked input[type=text], .classic-field.stacked textarea { width: 100%; font-size: 0.8rem; }
.classic-help { font-size: 0.71rem; line-height: 1.35; color: var(--dim); margin: 1px 0 5px; }
.classic-help.warn { color: var(--warn); }

/* Segmented pills — a radio group wearing the chip design language. The real
   radio is the focus target and stays visually hidden; the label is the pill, so
   arrow keys, the single tab stop, and group semantics are the platform's. */
.classic-seg { border: none; margin: 0 0 7px; padding: 0; min-width: 0; }
.classic-seg legend { font-size: 0.8rem; color: var(--muted); padding: 0; margin-bottom: 4px; }
.classic-seg-row { display: flex; flex-wrap: wrap; gap: 3px; background: #16161b; border: 1px solid var(--line); border-radius: 8px; padding: 3px; }
.classic-seg-item { display: inline-flex; flex: 1 1 auto; }
.classic-seg-item input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.classic-seg-label {
  flex: 1; text-align: center; white-space: nowrap;
  font-size: 0.72rem; font-weight: 700; padding: 5px 10px; border-radius: 6px;
  cursor: pointer; color: var(--dim); transition: background .12s, color .12s;
}
.classic-seg-label:hover { color: var(--muted); background: rgba(255,255,255,.04); }
.classic-seg-label.on { background: var(--accent); color: #fff; }
.classic-seg-label.on:hover { background: var(--accent-2); color: #fff; }
.classic-seg-item input:disabled + .classic-seg-label { opacity: .4; cursor: not-allowed; }
/* The ring is drawn on the label because the radio itself is invisible. */
.classic-seg-item input:focus-visible + .classic-seg-label { outline: 2px solid var(--accent-2); outline-offset: 1px; }

/* Slider row — track, live readout, and the button back to blank */
.classic-range { display: flex; align-items: center; gap: 8px; }
.classic-range input[type=range] { flex: 1; min-width: 0; accent-color: var(--accent); height: 20px; cursor: pointer; }
.classic-range-out { font-family: 'Roboto Mono', monospace; font-size: 0.72rem; color: var(--accent); min-width: 3.4em; text-align: right; }

/* Pill toggles — the ChatIS signature control, scaled to our palette */
.toggle-wrap { display: flex; align-items: center; gap: 10px; justify-content: flex-end; margin-bottom: 2px; }
.toggle-wrap > label:first-child { font-size: 0.82rem; color: var(--muted); cursor: pointer; user-select: none; order: -1; flex: 1; text-align: right; }
.toggle { position: relative; width: 40px; height: 22px; flex-shrink: 0; display: inline-block; }
.toggle input { position: absolute; opacity: 0; width: 40px; height: 22px; margin: 0; cursor: pointer; z-index: 1; }
.toggle-slider { position: absolute; inset: 0; background: #34343e; border-radius: 999px; cursor: pointer; transition: background .2s ease-in-out; }
.toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,.4); transition: transform .2s ease-in-out; }
.toggle input:checked + .toggle-slider { background: var(--accent); }
.toggle input:checked + .toggle-slider::before { transform: translateX(18px); }
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
.preview-label { font-size: 0.73rem; color: var(--dim); margin-bottom: 5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
.preview-label button { background: none; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); font-size: 0.72rem; padding: 3px 9px; cursor: pointer; transition: all .15s; text-transform: none; letter-spacing: 0; font-weight: 600; font-family: inherit; }
.preview-label button:hover { border-color: var(--accent); color: var(--accent); }
.preview-surface { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; box-shadow: inset 0 2px 12px rgba(0,0,0,.3); min-height: 90px; }
.preview-surface.white { background: #46464e; }
.preview-surface.checkered { background: repeating-conic-gradient(#1a1a20 0% 25%, #131318 0% 50%) 0 0 / 16px 16px; }
.preview-empty { display: flex; align-items: center; justify-content: center; padding: 20px 16px; color: var(--dim); font-size: 0.77rem; text-align: center; line-height: 1.45; }
/* "Preview data" marker, shown while a preview is showing fixtures rather than a
   real overlay. Deliberately quiet — it sits in the label row at the same size as
   the row's own text, states a fact, and is not styled as a warning. */
.preview-badge { border: 1px solid var(--line); border-radius: 6px; padding: 2px 7px; font-size: 0.66rem; color: var(--muted); letter-spacing: .06em; font-weight: 700; }

/* Custom preview messages, inside the chat output card.
   Compact on purpose: this sits under a 600px preview in a card that also holds
   the generated URL, so the fields share one row and the actions share another.
   Any taller and the chat settings card leaves the first screen. */
.preview-compose { margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px 7px; background: rgba(255,255,255,.015); }
.preview-compose-note { font-size: 0.71rem; line-height: 1.35; color: var(--dim); margin: 0 0 7px; }
.preview-compose-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
/* The platform pills take the slack, the name field keeps a usable width. */
.preview-compose-seg { flex: 1 1 260px; margin-bottom: 8px; }
.preview-compose-name { flex: 1 1 160px; }
.preview-compose-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
/* Disabled here means "nothing to do yet" rather than "not allowed": the button
   is still readable, it just stops looking clickable. */
.preview-compose-actions button:disabled { opacity: .45; cursor: not-allowed; border-color: var(--line); color: var(--dim); }
.preview-compose-status { font-size: 0.7rem; color: var(--dim); }

/* Live preview feed controls, inside the chat output card.
   Same card furniture as the composer beneath it — one border, one radius, one
   tint — because they are two controls on one preview rather than two panels. */
.preview-feed { margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px 7px; background: rgba(255,255,255,.015); }
.preview-feed-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
/* The switch keeps its natural width; the buttons sit beside it rather than
   stretching, so a wrapped row does not leave a full-width Pause. */
.preview-feed-row .toggle-wrap { flex: 0 0 auto; gap: 8px; }
.preview-feed-seg { margin: 7px 0 0; }
.preview-feed-seg legend { font-size: 0.71rem; font-weight: 700; color: var(--muted); letter-spacing: .04em; padding: 0; margin-bottom: 5px; }
.preview-feed-status { font-size: 0.7rem; color: var(--dim); margin: 6px 0 0; }
.preview-feed-row button:disabled { opacity: .45; cursor: not-allowed; border-color: var(--line); color: var(--dim); }

/* Preview counts, inside the Counter output card.
   Shorter than the chat composer because it has less to hold: four small numeric
   fields on one wrapping row, then one action. The counter preview surface is
   80px rather than 600px, so this card has room to spare — but it still sits
   above the Counter settings card, and growing it pushes those settings down. */
.preview-counts { margin-top: 8px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px 7px; background: rgba(255,255,255,.015); }
.preview-counts-fields { display: flex; gap: 10px; flex-wrap: wrap; border: 0; padding: 0; margin: 0 0 7px; }
.preview-counts-fields legend { font-size: 0.71rem; font-weight: 700; color: var(--muted); letter-spacing: .04em; padding: 0; margin-bottom: 6px; }
.preview-counts-field { display: flex; flex-direction: column; gap: 3px; flex: 1 1 92px; }
.preview-counts-field label { font-size: 0.68rem; color: var(--dim); }
/* Tabular digits so the four fields do not shift width as numbers are typed. */
.preview-counts-field input[type=text] { width: 100%; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.preview-counts-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.preview-counts-actions .classic-help { margin: 0; flex: 1 1 220px; }

/* URL result.
   The field takes the row and the two actions sit beside it at their natural
   height. Previously all three were align-items:stretch flex items, so Copy
   and Open grew to match a URL that wrapped to three lines — a ~70px-tall Copy
   button next to a two-line field. Now the actions are their own row-aligned
   group and the field is free to wrap without dragging them with it. */
.url-box { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; margin-top: 9px; }
.url-code { flex: 1 1 220px; min-width: 0; background: #101014; border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; font-family: 'Roboto Mono', monospace; font-size: 0.69rem; color: var(--accent); word-break: break-all; line-height: 1.55; max-height: 74px; overflow-y: auto; }
.url-actions { display: flex; gap: 6px; align-items: center; flex: 0 0 auto; }
.url-copy { background: var(--accent); color: #fff; border: none; border-radius: 8px; font-weight: 800; font-size: 0.78rem; padding: 7px 15px; cursor: pointer; transition: background .15s; font-family: inherit; white-space: nowrap; }
.url-copy:hover { background: var(--accent-2); }
.url-copy.ok { background: var(--ok); }
.url-open { display: inline-flex; align-items: center; justify-content: center; font-size: 0.78rem; font-weight: 800; padding: 7px 14px; border-radius: 8px; background: transparent; border: 1px solid rgba(74,132,250,.5); color: var(--accent); white-space: nowrap; }
.url-open:hover { background: rgba(74,132,250,.1); }
.url-warn { flex-basis: 100%; font-size: 0.72rem; color: var(--warn); line-height: 1.4; margin: 0; }
/* Empty is the common case — no fragment — so it must not reserve a line. */
.url-warn:empty { display: none; }
/* Below the grid breakpoint the actions wrap under the field and share its
   width, which is the touch-friendly arrangement. */
@media (max-width: 999px) {
  .url-actions { flex: 1 1 100%; }
  .url-copy, .url-open { flex: 1; padding: 10px 14px; }
}

/* Commands table */
.cmd-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.cmd-table th { text-align: left; color: var(--dim); font-weight: 700; text-transform: uppercase; font-size: 0.68rem; letter-spacing: .08em; padding: 3px 10px 6px; border-bottom: 1px solid var(--line); }
.cmd-table td { padding: 5px 10px; color: var(--muted); border-bottom: 1px solid rgba(44,44,53,.5); vertical-align: top; line-height: 1.4; }
.cmd-table td:first-child { color: var(--accent); font-family: 'Roboto Mono', monospace; white-space: nowrap; font-size: 0.72rem; }
.cmd-table tr:last-child td { border-bottom: none; }
.cmd-table-wrap { overflow-x: auto; }

/* Setup steps. Two side-by-side lists on a wide screen: they are independent
   procedures for two independent browser sources, so stacking them was pure
   height. */
.steps { list-style: none; padding: 0; margin: 0 0 10px; counter-reset: s; }
.steps li { counter-increment: s; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; font-size: 0.82rem; color: var(--muted); line-height: 1.45; }
.steps li::before { content: counter(s); background: rgba(74,132,250,.12); border: 1px solid rgba(74,132,250,.4); border-radius: 50%; min-width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: var(--accent); flex-shrink: 0; margin-top: 1px; }
.steps li strong { color: var(--text); }
.setup-sub { font-size: 0.79rem; font-weight: 800; color: var(--text); margin: 0 0 6px; }
.setup-cols { display: grid; grid-template-columns: 1fr; gap: 0 22px; }
@media (min-width: 1000px) { .setup-cols { grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); } }

/* Footer */
footer { border-top: 1px solid var(--line); padding: 16px 0; text-align: center; font-size: 0.77rem; color: var(--dim); margin-top: 14px; }
footer p { margin: 4px 0; }
footer a { color: var(--accent); }

/* Tablet and narrow desktop: one column, so two unusably narrow panels never
   happen. The control table stacks at the same breakpoint the original used. */
@media (max-width: 999px) {
  /* One track, and the dividers off with it — the column rules above are inside
     min-width queries, so this only has to undo the padding. */
  .form_col { padding-right: 0; }
}
@media (max-width: 720px) {
  .form_table { padding: 12px 12px 8px; }
  .header-logo { height: 200px; margin: -24px 0 -54px; }
  .header-strip { gap: 12px; flex-wrap: wrap; }
  .header-title { font-size: 1.6rem; }
  .page { padding: 0 14px 40px; }
  .card { padding: 14px 13px; border-radius: 12px; }
  .card.hero { padding: 15px 13px 12px; }
  .platform-input { min-width: 100%; }
  /* Touch targets: the chips, pills, and small buttons are the only controls that
     fall under a comfortable tap size at these sizes. Density is a desktop goal,
     and a 24px-tall pill on a phone is not a usable one. */
  .classic-chip-label { padding: 8px 14px; font-size: 0.7rem; }
  .classic-seg-label { padding: 9px 10px; }
  .classic-conn-btn, .classic-clear { padding: 8px 12px; }
  .toggle-wrap { margin-bottom: 6px; }
  .url-code { max-height: none; }
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
