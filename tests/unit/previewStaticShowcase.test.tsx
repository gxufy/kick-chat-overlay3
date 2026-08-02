import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import { CHAT_INTERVAL_MAX_MS } from '@/features/multichat/previewSimulator';
import { PREVIEW_ROSTER } from '@/features/multichat/previewRoster';
import { __resetPreviewIdentityClient } from '@/features/multichat/previewIdentityClient';

vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const preview = () => document.querySelector<HTMLIFrameElement>('iframe[title="MultiChat sample preview"]')!.contentDocument!.body;
const bodies = () => Array.from(preview().querySelectorAll('#chat_container .ck-body')).map((el) => el.textContent ?? '');
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const waitForGrowth = (from: number) => {
  let elapsed = 0;
  while (elapsed < CHAT_INTERVAL_MAX_MS * 2 && bodies().length <= from) {
    wait(250);
    elapsed += 250;
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  __resetPreviewIdentityClient();
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the curated moving Preview Data showcase', () => {
  it('renders the seven exact fallback identities on first paint', () => {
    render(<ClassicGenerator />);
    expect(bodies()).toHaveLength(PREVIEW_ROSTER.length);
    for (const entry of PREVIEW_ROSTER) expect(preview().textContent ?? '').toContain(entry.displayName);
  });

  it('moves at Fast speed without a control click', () => {
    render(<ClassicGenerator />);
    waitForGrowth(PREVIEW_ROSTER.length);
    expect(bodies().length).toBeGreaterThan(PREVIEW_ROSTER.length);
  });

  it('pauses, resumes, and resets the feed without losing the roster', () => {
    render(<ClassicGenerator />);
    waitForGrowth(PREVIEW_ROSTER.length);
    const delivered = bodies().length;
    fireEvent.click(screen.getByRole('button', { name: 'PAUSE' }));
    wait(300_000);
    expect(bodies()).toHaveLength(delivered);
    fireEvent.click(screen.getByRole('button', { name: 'RESUME' }));
    waitForGrowth(delivered);
    expect(bodies().length).toBeGreaterThan(delivered);
    fireEvent.click(screen.getByRole('button', { name: 'RESET FEED' }));
    expect(bodies()).toHaveLength(PREVIEW_ROSTER.length);
  });

  it('Reset Preview restores roster order and a running Fast feed', () => {
    render(<ClassicGenerator />);
    fireEvent.click(screen.getByRole('button', { name: 'LOAD MORE BADGES' }));
    fireEvent.click(screen.getByRole('button', { name: 'PAUSE' }));
    fireEvent.click(screen.getByRole('button', { name: 'RESET PREVIEW' }));
    expect(screen.getByRole('button', { name: 'PAUSE' })).toBeTruthy();
    expect(bodies()).toHaveLength(PREVIEW_ROSTER.length);
    for (const entry of PREVIEW_ROSTER) expect(preview().textContent ?? '').toContain(entry.displayName);
  });
});
