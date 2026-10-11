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

The user asked to examine the PRD and question them on implementation details until satisfied.

**Why:** The user requested requirements clarification before proceeding with development.

**How to apply:** Resolve consequential product and implementation decisions through focused questions before starting the build.
