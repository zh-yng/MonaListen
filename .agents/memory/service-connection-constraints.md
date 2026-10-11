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

Do not treat Gemini's model catalog as proof that a model can still generate content.

**Why:** During analysis debugging, Google's model catalog still listed a model whose generate-content endpoint returned a retirement/not-found response naming a replacement. A successful catalog request did not establish generation availability.

**How to apply:** Trust the explicit generate-content error over catalog membership. Verify a replacement before claiming analysis works, and distinguish model retirement, key restrictions, quota limits, and temporary overload instead of blaming every failure on the key. Do not silently substitute models or fabricate shapes when generation fails.
