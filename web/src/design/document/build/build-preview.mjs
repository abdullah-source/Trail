// Builds web/public/document-preview.html from Preview.tsx (rendered to static markup with
// react-dom/server) + tokens.css + fonts.css + preview.css + the framework-free runtime.
// Run from web/:  node src/design/document/build/build-preview.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const doc = join(dirname(fileURLToPath(import.meta.url)), '..');
const here = join(doc, 'preview');
const web = join(doc, '../../..');
const req = createRequire(createRequire(join(web, 'package.json')).resolve('vite'));
const esbuild = req('esbuild');

const tmp = mkdtempSync(join(tmpdir(), 'trail-preview-'));
const ssr = join(tmp, 'ssr.cjs');
await esbuild.build({
  stdin: {
    contents: `import { renderToStaticMarkup } from 'react-dom/server'; import { createElement } from 'react'; import { Preview } from './Preview.tsx'; export const html = renderToStaticMarkup(createElement(Preview));`,
    resolveDir: here,
    loader: 'tsx',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  define: { 'process.env.NODE_ENV': '"production"' },
  jsx: 'automatic',
  outfile: ssr,
  nodePaths: [join(web, 'node_modules')],
  logLevel: 'error',
});
const { html } = createRequire(import.meta.url)(ssr);

const rt = await esbuild.build({
  stdin: { contents: `import { mountDocument } from './runtime.ts'; mountDocument();`, resolveDir: doc, loader: 'ts' },
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  target: 'es2020',
  logLevel: 'error',
});
const js = rt.outputFiles[0].text;

const tokens = readFileSync(join(doc, 'tokens.css'), 'utf8').replace(/@theme inline \{[\s\S]*?\n\}\n/, '');
const fonts = readFileSync(join(doc, 'fonts.css'), 'utf8').replaceAll('url(/fonts/', 'url(fonts/');
const pv = readFileSync(join(here, 'preview.css'), 'utf8');

const page = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Trail · security document</title>
<meta name="description" content="Reference page for Trail's security-document design system (web/DESIGN-document.md). Generated; do not edit by hand.">
<link rel="icon" href="favicon.svg">
<style>
${fonts}
${tokens}
${pv}
</style>
</head>
<body>
${html}
<script>${js}</script>
</body>
</html>
`;
const out = join(web, 'public/document-preview.html');
writeFileSync(out, page);
console.log('wrote', out, (page.length / 1024).toFixed(0) + ' KB');
