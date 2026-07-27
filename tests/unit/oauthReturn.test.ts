/* The return-destination allowlist — an open-redirect boundary.
 *
 * A destination that survives an OAuth round trip is the classic open-redirect
 * shape, so the interesting cases are all the ways a hostile value might be
 * spelled. Because matching is exact equality against a fixed set rather than
 * parsing-then-validating, these all fail for one reason, and the test exists to
 * prove that reason holds rather than to enumerate a parser's edge cases.
 */
import { describe, expect, it } from 'vitest';
import {
  OAUTH_RETURN_ALLOWLIST,
  OAUTH_RETURN_CLASSIC,
  OAUTH_RETURN_DEFAULT,
  OAUTH_RETURN_LEGACY,
  OAUTH_RETURN_WORKSPACE,
  resolveReturnDestination,
  validateReturnDestination,
} from '@/lib/oauthReturn';

describe('allowlist contents', () => {
  it('contains exactly the three internal generator paths', () => {
    expect(OAUTH_RETURN_ALLOWLIST).toEqual([
      '/tools/multichat',
      '/classic/multichat',
      '/multichat',
    ]);
  });

  it('defaults to the workspace', () => {
    expect(OAUTH_RETURN_DEFAULT).toBe(OAUTH_RETURN_WORKSPACE);
    expect(OAUTH_RETURN_DEFAULT).toBe('/tools/multichat');
  });

  it('holds only root-relative single-slash paths', () => {
    for (const entry of OAUTH_RETURN_ALLOWLIST) {
      expect(entry.startsWith('/')).toBe(true);
      expect(entry.startsWith('//')).toBe(false);
      expect(entry).not.toContain(':');
      expect(entry).not.toContain('#');
      expect(entry).not.toContain('?');
    }
  });
});

describe('accepted destinations', () => {
  it('accepts each allowlisted path and returns it verbatim', () => {
    for (const entry of OAUTH_RETURN_ALLOWLIST) {
      expect(validateReturnDestination(entry)).toBe(entry);
      expect(resolveReturnDestination(entry)).toBe(entry);
    }
  });

  it('accepts the classic and legacy paths specifically', () => {
    expect(validateReturnDestination(OAUTH_RETURN_CLASSIC)).toBe('/classic/multichat');
    expect(validateReturnDestination(OAUTH_RETURN_LEGACY)).toBe('/multichat');
  });
});

describe('refused destinations', () => {
  /* Grouped by the trick each one attempts. Every case must be refused. */
  const REFUSED: readonly [string, unknown][] = [
    ['absolute http', 'http://evil.example.com/'],
    ['absolute https', 'https://evil.example.com/tools/multichat'],
    ['protocol-relative', '//evil.example.com'],
    ['protocol-relative with path', '//evil.example.com/tools/multichat'],
    ['backslash-relative', '\\\\evil.example.com'],
    ['mixed slash', '/\\evil.example.com'],
    ['userinfo trick', 'https://example.com@evil.example.com'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>'],
    ['traversal up', '/tools/../../etc/passwd'],
    ['traversal to allowlisted', '/tools/multichat/../../evil'],
    ['encoded slash prefix', '%2F%2Fevil.example.com'],
    ['encoded allowlisted path', '%2Ftools%2Fmultichat'],
    ['double-encoded', '%252Ftools%252Fmultichat'],
    ['trailing slash variant', '/tools/multichat/'],
    ['query appended', '/tools/multichat?x=1'],
    ['fragment appended', '/tools/multichat#twitchConnectionId=x'],
    ['leading whitespace', ' /tools/multichat'],
    ['trailing whitespace', '/tools/multichat '],
    ['newline injection', '/tools/multichat\nSet-Cookie: a=b'],
    ['carriage return injection', '/tools/multichat\r\nLocation: http://evil'],
    ['null byte', '/tools/multichat\0'],
    ['case variant', '/Tools/MultiChat'],
    ['relative no slash', 'tools/multichat'],
    ['empty string', ''],
    ['unknown internal path', '/tools/counter'],
    ['api path', '/api/twitch/oauth/start'],
    ['repeated parameter array', ['/tools/multichat', '/multichat']],
    ['array single', ['/tools/multichat']],
    ['undefined', undefined],
    ['null', null],
    ['number', 1],
    ['object', { toString: () => '/tools/multichat' }],
    ['prototype key', '__proto__'],
  ];

  it.each(REFUSED)('refuses %s', (_label, candidate) => {
    expect(validateReturnDestination(candidate)).toBeNull();
  });

  it.each(REFUSED)('falls back to the workspace for %s', (_label, candidate) => {
    expect(resolveReturnDestination(candidate)).toBe('/tools/multichat');
  });

  it('never returns a value outside the allowlist', () => {
    for (const [, candidate] of REFUSED) {
      expect(OAUTH_RETURN_ALLOWLIST).toContain(resolveReturnDestination(candidate));
    }
  });

  it('refuses the counter workspace, which never starts an authorization', () => {
    expect(validateReturnDestination('/tools/counter')).toBeNull();
    expect(validateReturnDestination('/counter')).toBeNull();
  });
});
