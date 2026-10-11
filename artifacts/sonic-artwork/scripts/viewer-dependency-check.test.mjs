import test from 'node:test';
import assert from 'node:assert/strict';
import { assertJavaScript, checkGraph, mindUrl, readImportMap, resolveModule } from './viewer-dependency-check.mjs';

const imports = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.151.3/build/three.module.js',
  'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.151.3/examples/jsm/',
};
const markup = map => `<script type="importmap">${JSON.stringify({ imports: map })}</script>`;
const html = `${markup(imports)}<script type="module" src="/assets/index.js"></script>`;
const cssImport = 'three/addons/renderers/CSS3DRenderer.js';
const cssUrl = `${imports['three/addons/']}renderers/CSS3DRenderer.js`;

test('production map precedes scripts and covers CSS3DRenderer', () => {
  const { map } = readImportMap(html);
  assert.equal(resolveModule('three', mindUrl, map), imports.three);
  assert.equal(resolveModule(cssImport, mindUrl, map), cssUrl);
});
test('rejects lost, late, duplicate, or invalid import maps', () => {
  for (const bad of [
    '<script type="module"></script>',
    `<script type="module"></script>${markup(imports)}`,
    `${markup(imports)}${markup(imports)}`,
    '<script type="importmap">not JSON</script><script type="module"></script>',
  ]) assert.throws(() => readImportMap(bad), /import map/i);
});
test('rejects missing add-ons and mismatched or floating Three.js', () => {
  assert.throws(() => readImportMap(`${markup({ three: imports.three })}<script type="module"></script>`), /three\/addons/);
  for (const version of ['latest', '0.186.1', '^0.151.3']) {
    assert.throws(() => readImportMap(`${markup({ ...imports, three: imports.three.replace('0.151.3', version) })}<script type="module"></script>`), /incompatible/);
  }
});
test('rejects subpath overrides and unpinned direct dependencies', () => {
  assert.throws(() => readImportMap(`${markup({ ...imports, [cssImport]: cssUrl })}<script type="module"></script>`), /override/);
  assert.throws(() => resolveModule('https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js', mindUrl, { imports }), /Unpinned/);
});
test('missing bare dependency names the specifier, importer, and repair', () => {
  assert.throws(() => resolveModule(cssImport, mindUrl, { imports: { three: imports.three } }), error =>
    error.message.includes(cssImport) && error.message.includes(mindUrl) && error.message.includes('Fix index.html'));
});
test('rejects HTTP failures and non-JavaScript CDN responses', () => {
  assert.throws(() => assertJavaScript(new Response('missing', { status: 404 }), cssUrl), /HTTP 404/);
  assert.throws(() => assertJavaScript(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }), cssUrl), /not JavaScript/);
  assertJavaScript(new Response('export {}', { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } }), cssUrl);
});
test('walks relative, bare, re-export and literal dynamic imports recursively', async () => {
  const child = new URL('./child.js', mindUrl).href;
  const sources = new Map([
    [mindUrl, `import 'three'; export * from './child.js'; import('${cssImport}');`],
    [child, `export * from '${cssImport}';`],
    [cssUrl, `import 'three'; export class CSS3DRenderer {}`],
    [imports.three, 'export class Matrix4 {}'],
  ]);
  const requests = [];
  const fetchModule = async url => {
    requests.push(url);
    assert.ok(sources.has(url), `Unexpected dependency ${url}`);
    return new Response(sources.get(url), { headers: { 'Content-Type': 'text/javascript' } });
  };
  assert.equal((await checkGraph(mindUrl, { imports }, fetchModule)).size, 4);
  assert.equal(requests.length, 4);
  await assert.rejects(checkGraph(mindUrl, { imports: { three: imports.three } }, fetchModule), /Missing dependency.*CSS3DRenderer/);
});
test('rejects computed imports instead of silently skipping dependencies', async () => {
  await assert.rejects(checkGraph(mindUrl, { imports }, async () =>
    new Response('import(window.moduleUrl)', { headers: { 'Content-Type': 'text/javascript' } })), /Non-literal/);
});
