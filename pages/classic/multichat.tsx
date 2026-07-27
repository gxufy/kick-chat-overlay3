/* /classic/multichat — the original generator, at a stable address.
 *
 * The workspace at /tools/multichat is now the primary generator. This route
 * exists so the original is not withdrawn in the same change that replaces it:
 * if the workspace turns out to be wrong for someone, there is a working page to
 * point them at, and it is an allowlisted OAuth return destination in its own
 * right (see lib/oauthReturn), so connecting from here comes back here.
 *
 * It renders the same LandingPage component the legacy /multichat route renders
 * with no channel configured — the same component, not a copy, so the two cannot
 * drift and no generator logic is duplicated.
 */
import Head from 'next/head';
import LandingPage from '@/components/LandingPage';
import { SunsetBanner } from '@/components/SunsetBanner';

export default function ClassicMultichatPage() {
  return (
    <>
      <Head>
        <title>multichat-gxufy — classic generator</title>
        {/* Not a canonical duplicate of the workspace: same tool, different UI.
            Kept out of search results so the workspace is the entry point. */}
        <meta name="robots" content="noindex" />
      </Head>
      <SunsetBanner variant="landing" />
      <LandingPage />
    </>
  );
}
