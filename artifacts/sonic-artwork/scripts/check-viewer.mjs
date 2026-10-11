import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkGraph, mindUrl, readImportMap } from './viewer-dependency-check.mjs';

const root = new URL('../', import.meta.url);
try {
  const html = await readFile(new URL('dist/public/index.html', root), 'utf8');
  const { map, markup } = readImportMap(html);
  const engine = await readFile(new URL('src/lib/viewer-engine.ts', root), 'utf8');
  if (!engine.includes(`const mindUrl='${mindUrl}'`) || !engine.includes('import(/* @vite-ignore */mindUrl)')) {
    throw new Error('Viewer module loader changed. Update scripts/viewer-dependency-check.mjs to check the actual pinned entry point.');
  }
  const assets = new URL('dist/public/assets/', root);
  const jsFiles = (await readdir(assets)).filter(name => name.endsWith('.js'));
  const bundles = await Promise.all(jsFiles.map(name => readFile(new URL(name, assets), 'utf8')));
  if (!bundles.some(code => code.includes(mindUrl))) {
    throw new Error('Built viewer does not contain the checked MindAR URL. Rebuild and align the regression check with the shipped loader.');
  }
  const modules = await checkGraph(mindUrl, map);
  console.log(`PASS: production import-map order, pinned dependencies, and JavaScript CDN responses (${modules.size} modules).`);
  if (process.argv.includes('--webkit')) {
    const { checkWebKit } = await import('./viewer-webkit-check.mjs');
    await checkWebKit(markup, mindUrl);
  }
  console.log('This checks dependency loading only, not camera access, physical artwork tracking, or close-up performance.');
} catch (error) {
  const missingBuild = error.code === 'ENOENT' ? `Build output missing. Run the package build first (root: ${fileURLToPath(root)}). ` : '';
  console.error(`Viewer dependency check FAILED: ${missingBuild}${error.message}`);
  process.exitCode = 1;
}
