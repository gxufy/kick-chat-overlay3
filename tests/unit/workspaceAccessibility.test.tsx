/* Workspace accessibility: document structure and honest action feedback.
 *
 * Two things are checked that no other file covers. First, the page's landmark
 * and heading structure — a screen reader user arriving at the workspace needs a
 * main landmark and an h1, or heading navigation starts partway down a
 * hierarchy with no root. Second, that Copy only claims to have copied when the
 * clipboard actually accepted the text: the URL field is readonly, so someone
 * told "copied" when nothing was has no way to notice until they paste into OBS.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import OverlayUrlBar from '@/components/workspace/OverlayUrlBar';
import { multichatTool } from '@/lib/tools/multichat/config';
import { counterTool } from '@/lib/tools/counter/config';

const URL = 'https://example.com/multichat?kick=somechannel';

/* Everything currently announced by a live region in the subtree.
 *
 * The URL field keeps its own always-present error region, so there is more than
 * one role=status here by design. Asserting on the combined announced text is
 * what a screen reader user actually receives, and it does not depend on the
 * order the two regions happen to be rendered in. */
const announced = () =>
  screen
    .getAllByRole('status')
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* The nav lists every tool before the settings start, so without a bypass a
   keyboard user re-tabs the whole list on every visit. */
describe('skip link', () => {
  /* Written as two tests rather than it.each: the two tool descriptors have
     different style and runtime type parameters, and a shared array widens them
     to a union the shell's props cannot accept. */
  it('offers a bypass to the main landmark on multichat', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    expect(
      screen.getByRole('link', { name: /skip to settings/i }).getAttribute('href'),
    ).toBe('#workspace-main');
  });

  it('offers a bypass to the main landmark on the counter', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl="https://example.com" />);
    expect(
      screen.getByRole('link', { name: /skip to settings/i }).getAttribute('href'),
    ).toBe('#workspace-main');
  });

  it('is the first focusable element in the document', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea'),
    ).filter((el) => el.tabIndex >= 0);
    expect(focusable[0]).toBe(screen.getByRole('link', { name: /skip to settings/i }));
  });

  /* An in-page anchor moves focus reliably only if the target can hold it. */
  it('targets an element that can actually receive focus', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const target = document.getElementById('workspace-main');
    expect(target).not.toBeNull();
    expect(target?.tagName.toLowerCase()).toBe('main');
    expect(target?.tabIndex).toBe(-1);
  });
});

/* Previously three role="radio" buttons: the ARIA pattern without the keyboard
   behaviour it promises. Native inputs get one tab stop and arrow keys from the
   platform, so this asserts they really are native. */
/* The workspace now has more than one radiogroup — the preview Live/Demo switch
   is the other — so these queries are scoped to the group each one names. The
   assertions are unchanged in strictness; they are just aimed at the fieldset
   under test rather than at every radio on the page. `groupOf` resolves the
   fieldset from one of its own labels, so it cannot drift if the markup moves. */
function groupOf(optionLabel: string): HTMLElement {
  const input = screen.getByLabelText(optionLabel);
  const fieldset = input.closest('fieldset');
  expect(fieldset, `no fieldset around ${optionLabel}`).not.toBeNull();
  return fieldset as HTMLElement;
}

const radiosIn = (group: HTMLElement) =>
  Array.from(group.querySelectorAll<HTMLInputElement>('[role="radio"], input[type="radio"]'));

describe('preview background picker', () => {
  it('is a native radio group, not ARIA-role buttons', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const radios = radiosIn(groupOf('Transparent'));
    expect(radios.length).toBeGreaterThanOrEqual(3);
    for (const radio of radios) {
      expect(radio.tagName.toLowerCase()).toBe('input');
      expect(radio.getAttribute('type')).toBe('radio');
    }
  });

  it('shares one name, so the platform treats them as one group', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const names = new Set(
      radiosIn(groupOf('Transparent')).map((r) => r.getAttribute('name')),
    );
    expect(names.size).toBe(1);
  });

  it('has exactly one checked option and every option labelled', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const radios = radiosIn(groupOf('Transparent'));
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
    for (const label of ['Transparent', 'Dark', 'Light']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('changes the selection when another option is chosen', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const light = screen.getByLabelText('Light') as HTMLInputElement;
    fireEvent.click(light);
    expect(light.checked).toBe(true);
    expect((screen.getByLabelText('Transparent') as HTMLInputElement).checked).toBe(false);
  });
});

/* The preview mode switch held to the same bar as the background picker, rather
   than merely being excluded from its assertions. */
describe('preview mode switch', () => {
  const mountMultichat = () =>
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);

  it('is a native radio group, not ARIA-role buttons', () => {
    mountMultichat();
    const radios = radiosIn(groupOf('Live'));
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio.tagName.toLowerCase()).toBe('input');
      expect(radio.getAttribute('type')).toBe('radio');
    }
  });

  it('shares one name and has exactly one checked option', () => {
    mountMultichat();
    const radios = radiosIn(groupOf('Live'));
    expect(new Set(radios.map((r) => r.getAttribute('name'))).size).toBe(1);
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
  });

  it('names the group, so it is not an unlabelled fieldset', () => {
    mountMultichat();
    expect(groupOf('Live').querySelector('legend')?.textContent).toBe('Preview mode');
  });

  it('starts on Live, so the honest preview is the default', () => {
    mountMultichat();
    expect((screen.getByLabelText('Live') as HTMLInputElement).checked).toBe(true);
  });

  it('is absent for a tool that declares no demo', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl="https://example.com" />);
    expect(screen.queryByLabelText('Live')).toBeNull();
    expect(screen.queryByText('Preview mode')).toBeNull();
  });
});

describe('document structure', () => {
  it('exposes exactly one h1 naming the active tool', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe('MultiChat overlay generator');
  });

  it('names the h1 after whichever tool is active', () => {
    render(<GeneratorWorkspace tool={counterTool} baseUrl="https://example.com" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Viewer Counter overlay generator',
    );
  });

  it('exposes a main landmark', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('keeps the settings and preview headings below the h1', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    const h2s = screen
      .getAllByRole('heading', { level: 2 })
      .map((node) => node.textContent);
    expect(h2s).toContain('MultiChat settings');
    expect(h2s).toContain('Live preview');
  });

  it('keeps the tool navigation landmark labelled', () => {
    render(<GeneratorWorkspace tool={multichatTool} baseUrl="https://example.com" />);
    expect(screen.getByRole('navigation', { name: 'Overlay tools' })).toBeTruthy();
  });
});

describe('copy feedback', () => {
  const clipboardWith = (writeText: () => Promise<void>) => {
    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
    });
  };

  beforeEach(() => {
    cleanup();
  });

  it('reports success only after the write resolves', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    clipboardWith(writeText);
    render(<OverlayUrlBar url={URL} configured />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy overlay URL' }));

    expect(writeText).toHaveBeenCalledWith(URL);
    await waitFor(() =>
      expect(announced()).toBe('Overlay URL copied.'),
    );
  });

  it('reports failure and names the recovery when the write rejects', async () => {
    clipboardWith(vi.fn(() => Promise.reject(new Error('denied'))));
    render(<OverlayUrlBar url={URL} configured />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy overlay URL' }));

    await waitFor(() =>
      expect(announced()).toMatch(/copy it manually/i),
    );
    expect(announced()).not.toMatch(/copied\./i);
  });

  it('reports failure when the clipboard API is absent entirely', async () => {
    vi.stubGlobal('navigator', { ...window.navigator, clipboard: undefined });
    render(<OverlayUrlBar url={URL} configured />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy overlay URL' }));

    await waitFor(() =>
      expect(announced()).toMatch(/copy it manually/i),
    );
  });

  it('explains an unconfigured copy without touching the clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    clipboardWith(writeText);
    render(<OverlayUrlBar url={URL} configured={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy overlay URL' }));

    expect(writeText).not.toHaveBeenCalled();
    expect(announced()).toBe('Enter at least one channel first.');
  });

  it('clears a prior failure when a later copy succeeds', async () => {
    const writeText = vi
      .fn(() => Promise.resolve())
      .mockRejectedValueOnce(new Error('denied'))
      .mockResolvedValueOnce(undefined);
    clipboardWith(writeText);
    render(<OverlayUrlBar url={URL} configured />);

    const button = screen.getByRole('button', { name: 'Copy overlay URL' });
    fireEvent.click(button);
    await waitFor(() =>
      expect(announced()).toMatch(/manually/i),
    );

    fireEvent.click(button);
    await waitFor(() =>
      expect(announced()).toBe('Overlay URL copied.'),
    );
  });
});
