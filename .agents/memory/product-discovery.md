---
name: Product scope and discovery
description: User-confirmed release scope and requirements clarification approach.
---

The user selected the self-service artist platform for the first release, rather than a limited artwork pilot or concept prototype.

**Why:** The user explicitly selected this scope during requirements discovery.

**How to apply:** Scope the release around artist accounts, multiple artworks, a complete editor, publishing, and the accessible tracked viewer.

The first release includes camera exploration plus an accessible non-camera touch alternative.

**Why:** The user explicitly selected both modes during requirements discovery.

**How to apply:** Include a way to explore without camera tracking.

The non-camera mode is a touch map only, not a region list. The user emphasized: "remember that the viewers are blind."

**Why:** The user explicitly chose touch-only exploration and reiterated the intended audience.

**How to apply:** Treat blind visitors as the primary audience for exploration. Do not substitute region-list navigation for the chosen touch map. A helper may handle setup and positioning; independent nonvisual onboarding, orientation, and exit are not required.

Regions play sound only, with no spoken region-entry labels. Audio tracks must not cut between one another: they play continuously and mix/blend using region settings and distance.

**Why:** The user explicitly chose sound-only regions and clarified that overlapping spatial mixing, rather than track switching, is the intended experience.

**How to apply:** Preserve continuous loop playback while smoothly changing gains and panning. Do not restart or abruptly switch tracks on region entry. Overall artwork description remains separate from region-entry behavior.

The user stated that someone else can set up the experience for blind visitors.

**Why:** The user corrected the assumption that visitors must independently start, orient, explore, and exit without sight.

**How to apply:** Support assisted setup rather than imposing independent nonvisual operation as a release requirement. Keep the actual listening and exploration experience appropriate for blind visitors.

The camera viewer must support both exploring from a viewing distance and moving close to individual details.

**Why:** The user selected close detail exploration and then clarified that the app should support both distance and close-up behavior.

**How to apply:** Make close-range tracking a core technical requirement and validate MindAR tracking feasibility with representative artwork textures. Support transitions between distance and close-up behavior.

When camera tracking is lost, fade out the mix and guide the visitor back until tracking returns.

**Why:** The user confirmed fading and audio guidance, with both distance and detail exploration.

**How to apply:** Fade rather than leave stale spatial positions playing; restore the mix smoothly when the target reacquires.

Artists choose per region whether enclosed geometry uses interior plateau volume or falloff from a positioned point.

**Why:** The user selected per-region choice rather than one global falloff rule.

**How to apply:** Keep both falloff behaviors configurable on each sound region.

Artists will authenticate with Replit-managed Clerk.

**Why:** The user selected this provider over Auth0 and deferring sign-in.

**How to apply:** Use Replit-managed Clerk for artist accounts; viewers remain account-free.

Store uploaded artwork and generated experience files in Replit App Storage.

**Why:** The user chose App Storage over an existing external provider or deferring storage.

**How to apply:** Use App Storage for painting uploads, generated audio, and MindAR targets; do not store large assets in the database.

Keep Tiger Cloud with PostgreSQL/PostGIS as the required spatial database.

**Why:** The user chose Tiger Cloud over another PostGIS provider or deferring the decision.

**How to apply:** Plan a secure standard PostgreSQL connection and verify PostGIS availability before depending on spatial functions.

Gemini should draft editable segmentation-mask shapes for artist review.

**Why:** The user chose draft masks over descriptions-only or offering both modes.

**How to apply:** Generate shape suggestions as drafts; artists must be able to review, edit, accept, or discard them before publishing.

The user asked to examine the PRD and question them on implementation details until satisfied.

**Why:** The user requested requirements clarification before proceeding with development.

**How to apply:** Resolve consequential product and implementation decisions through focused questions before starting the build.
