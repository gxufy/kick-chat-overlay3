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
