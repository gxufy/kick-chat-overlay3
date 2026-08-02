import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ClassicGenerator from '@/components/classic/ClassicGenerator';
import OpenSourcePage from '@/pages/open-source';
import packageJson from '../../package.json';

vi.mock('next/head', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

afterEach(cleanup);

describe('AGPL source disclosure', () => {
  it('declares AGPL-3.0-or-later in package metadata', () => {
    expect(packageJson.license).toBe('AGPL-3.0-or-later');
  });

  it('links the generator to the source and license disclosure', () => {
    render(<ClassicGenerator />);
    expect(screen.getByRole('link', { name: 'Source & Open Source Licenses' }).getAttribute('href'))
      .toBe('/open-source');
  });

  it('identifies UChat, the exact pin, license, and corresponding source', () => {
    render(<OpenSourcePage />);
    expect(document.body.textContent).toContain('Fiszh/UChat');
    expect(document.body.textContent).toContain('ba8841c1db75af4f135ef1cd19f8745e5e12b4e3');
    expect(document.body.textContent).toContain('GNU Affero General Public License');
    expect(screen.getByRole('link', { name: 'Complete corresponding source' }).getAttribute('href'))
      .toBe('https://github.com/gxufy/multichat-gxufy');
  });
});
