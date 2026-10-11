# Viewer dependency regression checks

From the workspace root:

```sh
pnpm --filter @workspace/sonic-artwork run test:viewer-dependencies
PORT=3000 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/sonic-artwork run build
pnpm --filter @workspace/sonic-artwork run check:viewer:webkit
```

The build now fails if its production HTML loses or misorders the import map,
if the viewer entry point changes without updating the check, if a dependency
has no mapping, or if the CDN returns a missing file or non-JavaScript response.
It follows the actual MindAR module graph, including relative imports, bare
imports, subpaths, re-exports, and literal dynamic imports. It rejects computed
imports rather than silently leaving them unchecked. The paired pins are
MindAR 1.2.5 and Three.js 0.151.3; changing either requires deliberately updating
the check and verifying compatibility (MindAR needs `sRGBEncoding`).

`check:viewer` repeats the production HTML/CDN check without rebuilding.
Internet access to cdn.jsdelivr.net is required. A CDN outage fails the check;
it is not reported as a passed or skipped release check. The offline unit tests
include the original missing `three/addons/renderers/CSS3DRenderer.js` regression.

## Native WebKit probe

Install the pinned Playwright WebKit binary from the package:

```sh
cd artifacts/sonic-artwork
pnpm exec playwright install webkit
```

The host also needs Playwright's supported WebKit system libraries. On a
supported Linux CI runner, provision them using
`pnpm exec playwright install --with-deps webkit`. On Replit/NixOS, use the
package-management skill for system dependencies, not `apt`. The browser
download alone is insufficient on the current workspace: it lacks WebKit's
required shared libraries. The WebKit command reports launch failure with
setup instructions and exits nonzero; it never silently skips the probe.

The optional WebKit command runs a local isolated HTML document with the
validated production import map and performs a native `import()` of the live
CDN module, checking the `MindARThree` export. It uses no mocked CDN responses.
It does **not** load the app, sign in, construct the tracker, load an artist's
image or target, or start the camera. Camera access is also guarded against.

These checks establish dependency resolution and (when WebKit passes) module
evaluation only. They do not verify camera permission, physical artwork
tracking, close-up performance, or behavior on a real iPhone. A real-device
test is still necessary for those claims.
