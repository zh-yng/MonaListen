import { parse as parseHtml } from 'parse5';
import { init, parse as parseModules } from 'es-module-lexer';

// MindAR 1.2.5 uses sRGBEncoding, removed in newer Three.js releases.
export const mindUrl = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
const threeRoot = 'https://cdn.jsdelivr.net/npm/three@0.151.3/';
const fix = 'Fix index.html imports (three and three/addons/) using Three.js 0.151.3, before every module script, then rebuild.';

export function readImportMap(html) {
  const scripts = [];
  function visit(node) {
    if (node.tagName === 'script') scripts.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parseHtml(html));
  const attr = (node, name) => node.attrs.find(a => a.name === name)?.value;
  const maps = scripts.filter(node => attr(node, 'type') === 'importmap');
  if (maps.length !== 1) throw new Error(`Expected exactly one production import map. ${fix}`);
  if (!scripts.some(node => attr(node, 'type') === 'module')) {
    throw new Error('Production HTML has no module script. Rebuild the application before checking viewer dependencies.');
  }
  const mapNode = maps[0];
  if (scripts.some(node => attr(node, 'type') === 'module' && scripts.indexOf(node) < scripts.indexOf(mapNode))) {
    throw new Error(`Production import map appears after a module script. ${fix}`);
  }
  let map;
  try {
    map = JSON.parse(mapNode.childNodes.map(n => n.value ?? '').join(''));
  } catch {
    throw new Error(`Production import map is not valid JSON. ${fix}`);
  }
  if (map.scopes && Object.keys(map.scopes).length) throw new Error(`Scoped overrides are not supported by this viewer check. ${fix}`);
  if (map.imports?.three !== `${threeRoot}build/three.module.js` ||
      map.imports?.['three/addons/'] !== `${threeRoot}examples/jsm/`) {
    throw new Error(`Missing or incompatible dependency mapping for "three" or "three/addons/". ${fix}`);
  }
  for (const [key, value] of Object.entries(map.imports)) {
    if (key.startsWith('three/') && (key !== 'three/addons/' || value !== `${threeRoot}examples/jsm/`)) {
      throw new Error(`Unexpected Three.js subpath override "${key}". ${fix}`);
    }
  }
  return { map, markup: `<script type="importmap">${JSON.stringify(map)}</script>` };
}

export function resolveModule(specifier, parent, map) {
  let resolved;
  if (/^(https?:\/\/|\/|\.\/|\.\.\/)/.test(specifier)) {
    resolved = new URL(specifier, parent).href;
  } else {
    const key = Object.keys(map.imports ?? {})
      .filter(k => k === specifier || (k.endsWith('/') && specifier.startsWith(k)))
      .sort((a, b) => b.length - a.length)[0];
    const target = key && map.imports[key];
    if (!target || (key.endsWith('/') && !target.endsWith('/'))) {
      throw new Error(`Missing dependency "${specifier}" imported by ${parent}. ${fix}`);
    }
    resolved = key.endsWith('/') ? new URL(specifier.slice(key.length), target).href : target;
  }
  if (!resolved.startsWith('https://')) throw new Error(`Dependency "${specifier}" must resolve to a pinned HTTPS URL, got ${resolved}.`);
  const url = new URL(resolved);
  if (url.hostname !== 'cdn.jsdelivr.net' || !/^\/npm\/(?:three@0\.151\.3|mind-ar@1\.2\.5)\//.test(url.pathname) || url.search || url.hash) {
    throw new Error(`Unpinned or incompatible dependency "${specifier}" in ${parent}: ${resolved}. Keep MindAR 1.2.5 and Three.js 0.151.3 pinned together.`);
  }
  return resolved;
}

export function assertJavaScript(response, url) {
  if (!response.ok) throw new Error(`Dependency ${url} returned HTTP ${response.status}. Check the pinned file exists and CDN access is available.`);
  const type = response.headers.get('content-type') ?? '';
  if (!/^(?:text|application)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(type)) {
    throw new Error(`Dependency ${url} returned "${type || 'no Content-Type'}", not JavaScript. Check for a missing CDN file or an HTML error response.`);
  }
}

export async function checkGraph(entry, map, fetchModule = fetch) {
  await init;
  const visited = new Map();
  async function visit(url, parent) {
    if (visited.has(url)) return;
    // Mark before recursion to handle circular Three.js imports.
    visited.set(url, null);
    let response;
    try {
      response = await fetchModule(url, { signal: AbortSignal.timeout(60_000) });
    } catch (error) {
      throw new Error(`Cannot fetch dependency ${url} imported by ${parent}: ${error.message}. Check CDN/network access and retry the viewer check.`);
    }
    assertJavaScript(response, url);
    if (response.url && response.url !== url) {
      throw new Error(`Dependency ${url} redirected to ${response.url}. Use a direct pinned module URL.`);
    }
    const source = await response.text();
    visited.set(url, source);
    let imports;
    try {
      [imports] = parseModules(source);
    } catch (error) {
      throw new Error(`Cannot parse JavaScript dependency ${url}: ${error.message}`);
    }
    for (const item of imports) {
      if (item.type === 'import-meta') continue; // import.meta is not a dependency
      if (!item.specifier) throw new Error(`Non-literal module import in ${url}; extend this check to resolve it before release.`);
      await visit(resolveModule(item.specifier, url, map), url);
    }
  }
  await visit(entry, 'viewer-engine.ts');
  return visited;
}
