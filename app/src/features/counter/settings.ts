/* Viewer Counter control catalog.
 *
 * Every entry mirrors a control that already exists in the current generator,
 * and every default and option list is taken from lib/viewerCounterConfig —
 * the authoritative source. Nothing here declares its own defaults.
 *
 * Channel fields are deliberately absent: they belong to the workspace's
 * channel panel, not to a tool's appearance catalog.
 *
 * Browser-safe — no server-only imports, no secrets.
 */
import {
  ALIGNMENTS,
  DEFAULT_STYLE,
  STROKES,
  TEXT_SHADOWS,
  type ViewerCounterStyle,
} from '@/lib/viewerCounterConfig';
import {
  optionsFrom,
  titleCase,
  type SettingCatalog,
} from '@/lib/tools/settingTypes';

/** Non-channel Viewer Counter controls, in display order. */
export const COUNTER_CATALOG: SettingCatalog<ViewerCounterStyle> = [
  {
    key: 'combined',
    param: 'combined',
    type: 'toggle',
    label: 'Combined total',
    description:
      'One total across every configured platform. Off shows a separate count per platform.',
    default: DEFAULT_STYLE.combined,
  },
  {
    key: 'icons',
    param: 'icons',
    type: 'toggle',
    label: 'Platform icons',
    description: 'Show each platform’s icon beside its count.',
    default: DEFAULT_STYLE.icons,
  },
  {
    key: 'bg',
    param: 'bg',
    type: 'toggle',
    label: 'Pill background',
    description: 'Rounded translucent backdrop behind each count.',
    default: DEFAULT_STYLE.bg,
  },
  {
    key: 'align',
    param: 'align',
    type: 'select',
    label: 'Alignment',
    description: 'Horizontal position inside the browser source.',
    options: optionsFrom(ALIGNMENTS, titleCase),
    default: DEFAULT_STYLE.align,
  },
  {
    key: 'googleFont',
    param: 'font',
    type: 'text',
    label: 'Google font',
    description: 'Optional Google Fonts family name. Blank keeps the default DejaVu Sans counter font.',
    placeholder: 'Press Start 2P',
    default: DEFAULT_STYLE.googleFont,
  },
  {
    key: 'textShadow',
    param: 'textShadow',
    type: 'select',
    label: 'Text shadow',
    options: optionsFrom(TEXT_SHADOWS, titleCase),
    default: DEFAULT_STYLE.textShadow,
  },
  {
    key: 'stroke',
    param: 'stroke',
    type: 'select',
    label: 'Outline',
    options: optionsFrom(STROKES, titleCase),
    default: DEFAULT_STYLE.stroke,
  },
] as const;
