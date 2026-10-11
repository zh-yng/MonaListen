---
name: Runtime resets during testing
description: Recheck actual service state after an unexpected browser-testing worker reset
---

After an unexpected testing-worker reset, check the current managed workflow status before relying on earlier running logs.

**Why:** During a region-save investigation, an unexpected testing-worker reset coincided with all managed workflows being reported as not started, even though their earlier logs showed them running. Restarting the web and API workflows restored service access. This did not establish the cause of the user's earlier browser failure.

**How to apply:** Check and restart only the services relevant to the request. Warn artists with unsaved editor changes to cancel reload/discard prompts, and do not treat an isolated test account's successful save as proof that the user's browser-specific failure is fixed.
