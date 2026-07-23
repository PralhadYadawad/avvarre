---
name: avvarre:garden
description: Audit the workspace persistent memory folders (.avvarre/) to detect context drift, conventions mismatch, and stalled task lists.
---

# avvarre:garden — Memory Gardening Skill

Audits the workspace persistent memory folders (`.avvarre/`) to detect context drift, conventions mismatch, and stalled task lists.

## Core Workflow: Gardening Audit

1. **Audit** — run `avvarre_garden` with the current workspace directory.
2. **Review Warnings** — inspect reported alerts for:
   - **Context Drift** (undocumented directories/dependencies)
   - **Conventions Drift** (style violations in sampled files)
   - **Stale Tasks** (in-progress > 7 days, unstarted > 30 days)
   - **Log Freshness** (no entries in last 7 days)
3. **Offer Remediation** — offer to automatically apply the suggestions to update `.avvarre/` files. Only edit if the user agrees.
