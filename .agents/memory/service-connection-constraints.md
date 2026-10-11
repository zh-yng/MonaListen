---
name: Provider connection constraints
description: Tiger SSL semantics and the safe MindAR browser-only distribution decision
---

Honor the supplied Tiger connection's explicit SSL mode, rather than silently loosening a failed strict connection.

**Why:** Modern node-postgres interprets `sslmode=require` as verify-full unless libpq compatibility is selected. Tiger initializes some services with self-signed certificates. The user's supplied URL explicitly requests encrypted require mode, not CA verification.

**How to apply:** Preserve strict verify-ca/verify-full if selected. Explain that require encrypts but does not authenticate the database server; stronger verification needs a provider-signed certificate.

Use MindAR's pinned browser distribution without its Node/canvas dependencies.

**Why:** Installing the current MindAR npm package pulled a tar dependency rejected by the package firewall; the compiler/tracker browser distribution does not need that native dependency.

**How to apply:** Do not bypass the firewall. Keep the browser build and its compatible Three.js dependency pinned together.

Browser-only CDN modules resolve imports through the browser, not Vite's npm dependency resolution.

**Why:** A production build succeeded while the viewer failed in Safari: MindAR's remote module imported a Three.js add-on that was not covered by the browser import map. Bundling checks did not traverse the external module loaded with Vite's ignore directive.

**How to apply:** Keep the import map before module scripts and verify the remote dependency graph, including bare subpath imports, against the pinned compatible versions. A successful Vite build alone does not verify externally loaded viewer modules.

Preserve MindAR's camera-video sizing and centering; prevent global media width limits from clamping its oversized video.

**Why:** MindAR sizes the video to cover the stage and offsets it to center the crop. Tailwind's default video max-width clamped that width without changing the offset, leaving a large dark strip even while phone tracking worked.

**How to apply:** Scope the media-reset override to the camera stage and allow the library's oversized video to be clipped by the stage. Do not independently force video width, height, or positioning, which can disagree with its camera projection. Verify coverage in portrait and landscape.

Keep remote viewer dependency verification as a fail-closed release check; treat native browser evaluation as a separate result when the host cannot launch WebKit.

**Why:** CDN outages and missing JavaScript files must not look like successful validation. The Replit/NixOS host can download Playwright's WebKit binary but still lack its many required shared libraries; downloading the browser alone is not proof the native import probe ran.

**How to apply:** Report static graph and native browser outcomes separately. Provision native probes on a supported host and never infer camera or physical tracking reliability from module loading.

Do not treat Gemini's model catalog as proof that a model can still generate content.

**Why:** During analysis debugging, Google's model catalog still listed a model whose generate-content endpoint returned a retirement/not-found response naming a replacement. A successful catalog request did not establish generation availability.

**How to apply:** Trust the explicit generate-content error over catalog membership. Verify a replacement before claiming analysis works, and distinguish model retirement, key restrictions, quota limits, and temporary overload instead of blaming every failure on the key. Do not silently substitute models or fabricate shapes when generation fails.

For Git-provider connections, verify actual Git authentication rather than trusting connection-health metadata.

**Why:** A GitHub connection reported active/healthy and already attached, but workspace Git authentication was rejected and the GitHub CLI had no login. Standard integration reconnect cards then rejected both the saved connection and connector handles. This is distinct from an unavailable repository or divergent Git history.

**How to apply:** Start with a read-only remote check. Follow the documented OAuth recovery flow, but stop retrying cards if they reject the provider handles. Consult current Replit documentation for the account's Git Providers reconnect flow. Never extract provider credentials, put tokens into remotes, force-push, or modify existing history to work around authentication failures.
