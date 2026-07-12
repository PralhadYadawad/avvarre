---
name: 'avvarre'
description: 'Persistent AI memory hooks — bootstrap project setup, load conventions and tasks, auto-detect stack for community skills, and log sessions on end.'
tags: ['code-quality', 'memory', 'session-logging', 'automation']
---

# avvarre Hooks

4 lifecycle hooks that give GitHub Copilot persistent project memory across sessions.

## Hooks

| Hook | Event | What It Does |
|------|-------|-------------|
| Bootstrap | SessionStart | Checks if `.avvarre/` exists, suggests `/avvarre-init` if missing |
| Context Loader | SessionStart | Loads conventions, last session log, pending tasks, and available skills |
| Skill Suggest | SessionStart | Auto-detects tech stack (3-layer: manifests, configs, extensions), suggests community skills |
| Session End | Stop | Phase 1: reminds AI to update tasks/context. Phase 2: logs session to `session-log.md` |

## Prerequisites

These hooks work best with the avvarre MCP server for full functionality:

```json
{
  "mcpServers": {
    "avvarre": {
      "command": "npx",
      "args": ["-y", "avvarre@latest"]
    }
  }
}
```

## Installation

Copy `hooks.json` and the script files to your hooks directory.

## How It Works

1. **Session starts** — bootstrap checks for `.avvarre/`, context loader reads conventions + tasks, skill suggest detects your stack
2. **During session** — AI follows loaded conventions and skills
3. **Session ends** — Phase 1 blocks stop to remind AI to update `.avvarre/` files, Phase 2 auto-generates session log entry

All scripts read JSON from stdin (`cwd`, `sessionId`, `transcript_path`, `stop_hook_active`) and output JSON to stdout.
