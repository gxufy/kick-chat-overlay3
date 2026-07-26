/* Generator workspace route — additive, and not linked from anywhere yet.
 *
 * /tools/counter hosts the Viewer Counter generator in the new three-column
 * workspace. The existing generator at /multichat and the /counter overlay are
 * untouched, and nothing redirects here.
 *
 * The tool id arrives as a build-time prop rather than from router.query, so
 * the shell is prerendered rather than blank until hydration, and an
 * unregistered id is a real 404 instead of a client-rendered message.
 */
import Head from 'next/head';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { useEffect, useState } from 'react';
import GeneratorWorkspace from '@/components/workspace/GeneratorWorkspace';
import { TOOLS, findTool } from '@/lib/tools/registry';

type Props = { toolId: string };

export const getStaticPaths: GetStaticPaths = () => ({
  paths: TOOLS.map((tool) => ({ params: { tool: tool.id } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = ({ params }) => {
  const toolId = typeof params?.tool === 'string' ? params.tool : '';
  if (!findTool(toolId)) return { notFound: true };
  return { props: { toolId } };
};

export default function ToolWorkspacePage({ toolId }: Props) {
  /* Matches the existing generator's approach: a sensible production default so
     the first paint has a URL, corrected to the real origin on mount. */
  const [baseUrl, setBaseUrl] = useState('https://multichat-gxufy.com');
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  /* getStaticPaths only emits registered ids, so this cannot be undefined at
     runtime; the guard is here so the type is narrowed without a cast. */
  const tool = findTool(toolId);
  if (!tool) return null;

  return (
    <>
      <Head>
        {/* Single text node: a title element with multiple children breaks
            hydration and renders markup as text. */}
        <title>{`${tool.label} | multichat-gxufy`}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <GeneratorWorkspace tool={tool} baseUrl={baseUrl} />
    </>
  );
}
