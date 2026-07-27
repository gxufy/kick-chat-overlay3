/* Help rendering — generic panel, MultiChat's sections, counter's absence.
 *
 * The panel is descriptor-driven, so the two things worth proving are that it
 * renders whatever data it is given without knowing what the data means, and
 * that a tool declaring no help gets no empty scaffolding.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import ToolHelpPanel from '@/components/workspace/ToolHelpPanel';
import { MULTICHAT_COMMANDS } from '@/lib/multichatCommands';
import { counterTool } from '@/lib/tools/counter/config';
import { multichatTool } from '@/lib/tools/multichat/config';
import { MULTICHAT_HELP } from '@/lib/tools/multichat/help';

const BASE = 'https://example.com';

afterEach(cleanup);

describe('ToolHelpPanel', () => {
  it('renders nothing at all for an empty section list', () => {
    const { container } = render(<ToolHelpPanel sections={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders arbitrary sections without knowing what they describe', () => {
    render(
      <ToolHelpPanel
        sections={[
          {
            id: 'x',
            title: 'Some section',
            intro: 'An intro.',
            entries: [{ syntax: 'do thing', summary: 'It does.', detail: 'Extra.' }],
            footnote: 'A footnote.',
          },
        ]}
      />,
    );
    expect(screen.getByText('Some section')).toBeTruthy();
    expect(screen.getByText('An intro.')).toBeTruthy();
    expect(screen.getByText('do thing')).toBeTruthy();
    expect(screen.getByText('It does. Extra.')).toBeTruthy();
    expect(screen.getByText('A footnote.')).toBeTruthy();
  });

  it('omits optional prose rather than rendering empty elements', () => {
    render(
      <ToolHelpPanel
        sections={[{ id: 'y', title: 'Bare', entries: [{ syntax: 's', summary: 'm.' }] }]}
      />,
    );
    expect(document.querySelectorAll('p')).toHaveLength(0);
  });

  it('uses collapsed native disclosures, so keyboard support is the platform’s', () => {
    render(<ToolHelpPanel sections={MULTICHAT_HELP} />);
    const details = Array.from(document.querySelectorAll('details'));
    expect(details).toHaveLength(MULTICHAT_HELP.length);
    for (const d of details) {
      expect(d.hasAttribute('open')).toBe(false);
      expect(d.querySelector('summary')).not.toBeNull();
    }
  });

  it('marks the show/hide affordance decorative, since details announces state', () => {
    render(<ToolHelpPanel sections={MULTICHAT_HELP} />);
    for (const summary of Array.from(document.querySelectorAll('summary'))) {
      expect(summary.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('keys entries uniquely within every section', () => {
    for (const section of MULTICHAT_HELP) {
      const syntaxes = section.entries.map((e) => e.syntax);
      expect(new Set(syntaxes).size).toBe(syntaxes.length);
    }
    const ids = MULTICHAT_HELP.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MultiChat help in the workspace', () => {
  const mount = () => render(<GeneratorWorkspace tool={multichatTool} baseUrl={BASE} />);

  it('renders every documented command, derived from the parser metadata', () => {
    mount();
    for (const command of MULTICHAT_COMMANDS) {
      expect(screen.getByText(command.syntax)).toBeTruthy();
    }
  });

  it('documents the alias and the moderator requirement once', () => {
    mount();
    const footnote = screen.getByText(/works as an alias for/);
    expect(footnote.textContent).toContain('!kickchat');
    expect(footnote.textContent).toContain('!multichat');
    expect(footnote.textContent).toMatch(/Moderators and the broadcaster only/);
  });

  it('states the truthful preview, copy, and background facts', () => {
    mount();
    expect(screen.getByText('The preview is the real overlay')).toBeTruthy();
    expect(screen.getByText('Copy gives you the OBS URL')).toBeTruthy();
    expect(screen.getByText('Preview background is preview-only')).toBeTruthy();
    expect(screen.getByText(/never appears in the URL and never reaches OBS/)).toBeTruthy();
  });

  it('states the icon compatibility rule and the Twitch pin requirement', () => {
    mount();
    expect(screen.getByText(/With one channel configured no marker is drawn/)).toBeTruthy();
    expect(
      screen.getByText(/Require a connected Twitch account matching your Twitch channel/),
    ).toBeTruthy();
  });

  it('cites one canonical OBS size and one stated alternative', () => {
    mount();
    expect(screen.getByText('680 × 280')).toBeTruthy();
    expect(screen.getByText('830 × 230')).toBeTruthy();
    /* summary and detail render into one description element. */
    expect(screen.getByText(/^Recommended browser-source size\./)).toBeTruthy();
    expect(screen.getByText(/^Wider, shorter alternative\./)).toBeTruthy();
    /* Exactly one row claims to be recommended. */
    expect(screen.queryAllByText(/Recommended/)).toHaveLength(1);
  });

  it('places help after the settings catalog in the centre panel', () => {
    mount();
    const panel = document.querySelector('[aria-labelledby="tool-config-heading"]');
    const settings = panel?.querySelector('#setting-textSize');
    const help = panel?.querySelector('details');
    expect(settings).not.toBeNull();
    expect(help).not.toBeNull();
    expect(
      settings!.compareDocumentPosition(help!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('keeps help out of the channel panel', () => {
    mount();
    const fieldset = document.querySelector('#channel-kick')?.closest('fieldset');
    expect(fieldset?.querySelector('details')).toBeNull();
  });
});

describe('counter has no help section', () => {
  it('renders no disclosure at all on /tools/counter', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    expect(counterTool.help).toBeUndefined();
    expect(document.querySelectorAll('details')).toHaveLength(0);
  });

  it('documents no chat commands for the counter', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl={BASE} />);
    expect(document.body.textContent).not.toContain('!multichat');
    expect(document.body.textContent).not.toContain('!kickchat');
  });
});
