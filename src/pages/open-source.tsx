import Head from 'next/head';
import Link from 'next/link';

const SOURCE_URL = 'https://github.com/gxufy/multichat-gxufy';
const UCHAT_URL =
  'https://github.com/Fiszh/UChat/tree/ba8841c1db75af4f135ef1cd19f8745e5e12b4e3';

export default function OpenSourcePage() {
  return (
    <>
      <Head>
        <title>Source &amp; Open Source Licenses — multichat-gxufy</title>
        <meta
          name="description"
          content="Source code, license, and upstream notices for multichat-gxufy."
        />
      </Head>
      <main className="source-page">
        <article>
          <p className="eyebrow">multichat-gxufy</p>
          <h1>Source &amp; Open Source Licenses</h1>
          <p>
            This network application is licensed under the GNU Affero General
            Public License, version 3 or (at your option) any later version.
          </p>
          <div className="actions">
            <a href={SOURCE_URL}>Complete corresponding source</a>
            <a href={`${SOURCE_URL}/blob/main/LICENSE`}>GNU AGPL v3 license</a>
            <a href={`${SOURCE_URL}/blob/main/NOTICE.md`}>Notices</a>
          </div>
          <h2>UChat attribution</h2>
          <p>
            The chat preview and badge workflow includes code and behavior
            copied or adapted from <a href={UCHAT_URL}>Fiszh/UChat</a> at commit{' '}
            <code>ba8841c1db75af4f135ef1cd19f8745e5e12b4e3</code>, licensed
            under GNU AGPL v3 or later. Copyright (C) 2026 Fish (Fiszh).
            MultiChat modifications are dated 2026-08-01.
          </p>
          <p>
            Provider names and fetched artwork belong to their respective
            owners. This project is not affiliated with Twitch, Kick, YouTube,
            TikTok, 7TV, BTTV, or FFZ.
          </p>
          <Link href="/multichat">Back to MultiChat</Link>
        </article>
      </main>
      <style>{`
        :global(html, body) { margin: 0; min-height: 100%; background: #11151b; }
        :global(body) { color: #eef4ff; font-family: Montserrat, Arial, sans-serif; }
        .source-page { min-height: 100vh; padding: 48px 20px; box-sizing: border-box; }
        article { max-width: 760px; margin: 0 auto; padding: 32px; border: 1px solid #293445;
          border-radius: 16px; background: #191f28; box-shadow: 0 18px 60px #0007; }
        .eyebrow { color: #62a8ff; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
        h1 { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.05; margin: 8px 0 24px; }
        h2 { margin-top: 34px; }
        p { color: #c7d1df; line-height: 1.7; }
        a { color: #62a8ff; }
        code { overflow-wrap: anywhere; }
        .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0; }
        .actions a { padding: 10px 14px; border: 1px solid #3b82d0; border-radius: 9px;
          background: #173254; color: #fff; font-weight: 700; text-decoration: none; }
        @media (max-width: 600px) { .source-page { padding: 18px 10px; } article { padding: 22px 18px; } }
      `}</style>
    </>
  );
}
