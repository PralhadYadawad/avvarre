# avvarre — Project Context

## What Is avvarre

avvarre is an **AI-first code quality ecosystem** — an MCP server + VS Code agent plugin enforcing Google Style Guides across 21 languages/formats. Instant regex analysis (650+ rules) + optional AI deep review via any LLM provider.

**One-liner:** *The AI coding copilot that remembers your project, enforces quality, and doesn't lose context between sessions.*

---

## Why It Exists

1. **AI-generated code ignores style guides** — LLMs produce code that runs but is unmaintainable
2. **Vibe coding has no memory** — each session starts from scratch, devs re-explain everything
3. **No quality gate inside the agent** — traditional linters run in CI, not in the AI's context
4. **Existing linters are language-specific** — no single tool covers 21 languages consistently

**Solution:** 650+ rules across 21 languages, `.avvarre/` persistent memory, MCP server the AI uses proactively, single tool for all languages.

---

## Architecture (6 Layers)

| Layer | Name | What It Does |
|-------|------|-------------|
| 1 | The Linter | 650+ regex rules across 21 languages enforcing Google Style Guides |
| 2 | AI Deep Review | LLM analysis catching semantic issues regex can't |
| 3 | Agent Plugin | VS Code plugin — skills, agent, slash commands, hooks |
| 4 | Vibe Coding Ecosystem | Persistent project memory, dynamic skills, session continuity |
| 5 | Insights & Distribution | Score history, PR gates, badges, npm, CI |
| 6 | AST Code Review Graph | Traces downstream code dependencies & alerts of impact/test gaps on file edits |

```
Developer in IDE (Cursor / Claude Desktop / VS Code)
        |  MCP Protocol (stdio)
+------------------------------------------------+
|            avvarre MCP Server                 |
|  +--------------+    +-----------------------+  |
|  | Layer 1       |    | Layer 2               |  |
|  | 650+ rules    |    | AI Deep Review        |  |
|  | Regex (instant)|    | (Gemini/OpenAI/Groq) |  |
|  +--------------+    +-----------------------+  |
|         +------ Merged → Structured JSON ----+  |
|                            |                    |
|                [Layer 6: AST Dependency Graph]  |
+------------------------------------------------+
        |
+------------------------------------------------+
|  Agent Plugin (VS Code 1.110+)                  |
|  Skills | Agent | Commands | Hooks | Ecosystem  |
+------------------------------------------------+
```

### 9 MCP Tools

| Tool | Purpose | Needs API Key? |
|------|---------|:-:|
| `avvarre_file` | Full AI + regex review with fixes (regex-only fallback). Pass `workspaceRoot` for history. | Optional |
| `avvarre_workspace` | Scan directory → heatmap, score trends, optional badge | Optional |
| `list_rules` | Browse all 650+ rules by language | No |
| `scaffold_avvarre` | Create `.avvarre/` ecosystem + dynamic skills | No |
| `setup_claude_code` | Bootstraps `.claude/`, `.avvarre/`, and `CLAUDE.md` in one command | No |
| `avvarre_pr` | PR quality gate on git diff. Takes `minScoreThreshold`. | No |
| `suggest_skills` | Auto-detect stack, fetch/decline community skills | No |
| `avvarre_get_impact` | Analyze changed files to compute blast radius, risk scores, and test gaps | No |
| `avvarre_garden` | Audits `.avvarre/` persistent memory for drift and stale tasks | No |

> **Resources:** avvarre exposes 21 MCP **resources** (one per language) at `avvarre://rules/{language}` so AI agents can read rule rationale directly.

### Scoring

- **Score:** 0-100 = `max(0, 100 - sum(penalties))`
- **Penalties:** critical=15, high=10, medium=5, low=2
- **Grades:** A (90+), B (80+), C (70+), D (60+), F (<60)
- **Dampening:** Files >100 lines get `1 + log10(lines/100)` factor

---

## Language Support (21)

| Language | Rules | Language | Rules |
|----------|:-----:|----------|:-----:|
| Python | 46 | Swift | 35 |
| JavaScript | 49 | Objective-C | 42 |
| TypeScript | 74* | C# | 37 |
| Java | 39 | Dart | 49 |
| Go | 33 | HTML/CSS | 31 |
| C++ | 44 | Markdown | 16 |
| Kotlin | 39 | JSON | 15 |
| Shell | 37 | XML | 18 |
| R | 36 | Vimscript | 18 |
| | | Lisp | 26 |
| | | Angular | 15 |

*TypeScript = all JS rules (49) + 25 TS-specific. Total: 650+ unique rules covering 100% of Google's published style guides.

### AI Providers

Works with **any OpenAI-compatible API** + Google Gemini. No key = regex-only (still fully functional).

| Provider | Config |
|----------|--------|
| Gemini | `AI_PROVIDER=gemini` + `GEMINI_API_KEY` + `GEMINI_MODEL` |
| OpenAI / Groq / Together / Fireworks | `AI_BASE_URL` + `AI_API_KEY` + `AI_MODEL` |
| Ollama / LM Studio (local) | `AI_BASE_URL=http://localhost:PORT/v1` + `AI_API_KEY=ollama` + `AI_MODEL` |

---

## Setup

**Quick install (npm):**
```bash
npx -y avvarre@latest
```

**From source:**
```bash
git clone https://github.com/PralhadYadawad/avvarre.git && cd avvarre
npm install && npm run build
```

**IDE config** — add to `.vscode/mcp.json`, Cursor MCP settings, or `claude_desktop_config.json`:
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

**With AI deep review:**
```json
{
  "mcpServers": {
    "avvarre": {
      "command": "npx",
      "args": ["-y", "avvarre@latest"],
      "env": { "AI_BASE_URL": "...", "AI_API_KEY": "...", "AI_MODEL": "..." }
    }
  }
}
```

**Agent plugin** (VS Code 1.110+):
```json
"chat.plugins.enabled": true,
"chat.plugins.paths": { "path/to/avvarre/plugin": true }
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_BASE_URL` | OpenAI-compatible API base URL |
| `AI_API_KEY` | API key |
| `AI_MODEL` | Model name |
| `AI_PROVIDER` | Set to `gemini` for Google SDK |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Gemini model (default: `gemini-2.0-flash`) |

No variables = regex-only mode. Never crashes from missing config.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + TypeScript |
| MCP SDK | `@modelcontextprotocol/sdk` v1.0+ |
| AI (Gemini) | `@google/generative-ai` |
| AI (Universal) | `openai` SDK (OpenAI-compatible) |
| Build | `tsc` |
| Transport | stdio |

3 runtime deps: `@google/generative-ai`, `@modelcontextprotocol/sdk`, `openai`

---

## Project Structure

```
avvarre/
├── .avvarre/              # Project memory
│   ├── context.md           # This file
│   ├── tasks.md             # Task tracker (compressed format)
│   ├── conventions.md       # Coding conventions
│   ├── session-log.md       # Session handoffs
│   ├── history.json         # Score history
│   └── ignore               # Skip patterns
├── src/
│   ├── server.ts            # MCP server — 7 tools + 21 resources
│   ├── index.ts             # Entry point (stdio)
│   ├── types.ts             # Core types
│   ├── graph/               # AST Code Review Graph (New)
│   │   ├── index.ts         # SQLite Graph Store + blast-radius traversal
│   │   ├── parser.ts        # WASM-based web-tree-sitter parser
│   │   └── scoring.ts       # Risk scoring & review prioritization
│   ├── analyzer/
│   │   ├── engine.ts        # Language dispatch + rule execution
│   │   ├── scorer.ts        # Scoring (0-100) + grading (A-F)
│   │   └── rules/           # 21 rule files
│   ├── ai/
│   │   ├── client.ts        # AI client factory
│   │   ├── gemini.ts        # Gemini client
│   │   ├── universal.ts     # OpenAI-compatible client
│   │   ├── prompts.ts       # Language-specific system prompts
│   │   └── chunker.ts       # Large file chunking
│   ├── ecosystem/
│   │   ├── scaffold.ts      # .avvarre/ scaffolding
│   │   ├── skill_generator.ts # Dynamic skill templates from tech stack
│   │   ├── community_fetcher.ts # Fetches community skills from GitHub
│   │   ├── history.ts       # Score tracking
│   │   ├── masking.ts       # Context masking
│   │   ├── badge.ts         # Badge generation
│   │   ├── claude_setup.ts  # install --claude subcommand (global + per-project)
│   │   └── install.ts       # install subcommand — detect 7 IDEs, write MCP configs, inject rule files
│   └── workspace/
│       ├── scanner.ts       # Directory scanning + heatmap
│       └── pr_scanner.ts    # PR quality gate
├── cursor-plugin/           # Cursor Marketplace plugin
│   ├── .cursor-plugin/plugin.json  # Manifest (v0.5.3, hooks+mcpServers explicit paths, logo, repository)
│   ├── mcp.json             # MCP config (npx -y avvarre@latest)
│   ├── hooks/hooks.json     # Cursor hooks (camelCase: sessionStart/sessionEnd/preToolUse)
│   ├── agents/avvarre-reviewer.md  # Auto-discovered agent (identical to cursor-plugin)
│   ├── commands/            # 5 slash commands (identical to cursor-plugin)
│   ├── rules/avvarre.mdc  # Always-on .mdc rules file (identical to cursor-plugin)
│   ├── scripts/             # 5 production hook scripts (including hook-impact-warn.cjs)
│   ├── skills/avvarre/SKILL.md  # 7 tools (including avvarre_get_impact)
│   ├── logo.png             # Logo (37KB PNG)
│   └── README.md            # Cursor Marketplace README
├── claude-plugin/           # Claude Code plugin (SELF-CONTAINED, ready for --plugin-dir or marketplace)
│   ├── .claude-plugin/plugin.json  # Manifest (name, desc, version, author, license, homepage→avvarre, repo, keywords, logo)
│   ├── .mcp.json            # Claude MCP config (npx -y avvarre@latest)
│   ├── hooks/hooks.json     # Claude hooks (flat format, SessionStart/Stop/PreToolUse)
│   ├── hooks/               # hooks.json + 5 bundled .cjs scripts (including hook-impact-warn.cjs)
│   ├── agents/avvarre-reviewer.md  # allowed-tools: all 7 MCP tools
│   ├── commands/            # 5 slash commands (namespaced: /avvarre:command-name)
│   ├── skills/avvarre/SKILL.md  # 7 tools (including avvarre_get_impact)
│   └── logo.png             # Logo (37KB PNG)
├── antigravity-plugin/      # Antigravity 2.0 Plugin (for Antigravity IDE and CLI)
│   ├── plugin.json          # Manifest (name: avvarre)
│   ├── mcp_config.json      # MCP config (npx -y avvarre@latest)
│   ├── hooks.json           # Antigravity hooks (PreInvocation, PreToolUse, Stop)
│   ├── agents/              # Subagent definitions (avvarre-reviewer.md)
│   ├── rules/               # Workspace style guide rules (avvarre.md)
│   ├── skills/              # Skills converting to slash commands (/avvarre, /avvarre-init, etc.)
│   └── scripts/             # Hook scripts (hook-pre-invocation.cjs, hook-impact-warn.cjs, hook-session-end.cjs)
├── opencode-plugin/          # OpenCode extension plugin
│   ├── plugin.json          # Manifest (name: opencode-avvarre)
│   ├── mcp_config.json      # MCP server config (npx -y avvarre@latest)
│   ├── package.json         # Plugin bun/npm dependencies
│   └── plugins/avvarre/index.ts # OpenCode plugin hooks (created, idle, execute.after, commands)
├── awesome-copilot/         # PR-ready folder mirroring awesome-copilot repo layout (2026-04-05)
│   ├── agents/avvarre-reviewer.agent.md
│   ├── hooks/avvarre/ (README.md + hooks.json + 5 .cjs scripts including hook-impact-warn.cjs)
│   ├── plugins/avvarre/.github/plugin/plugin.json + README.md
│   └── skills/avvarre/SKILL.md
├── scripts/                 # Hook scripts (.cjs for ES module compat)
│   ├── hook-bootstrap.cjs   # SessionStart: checks .avvarre/ exists
│   ├── hook-context-loader.cjs  # SessionStart: loads conventions/tasks/session-log
│   ├── hook-skill-suggest.cjs   # SessionStart: auto-detect stack, suggest community skills
│   ├── hook-impact-warn.cjs # PreToolUse: traces blast-radius callers and test gaps
│   ├── hook-session-end.cjs # Stop: phase1=remind to update files, phase2=log session
│   └── test-hook.js         # End-to-end integration and parser verification script
├── marketing/               # Distribution & submission files
│   └── awesome-copilot/     # Files for github/awesome-copilot PR (2026-04-05, CONTRIBUTING.md compliant)
│       ├── agents/avvarre-reviewer.agent.md  # .agent.md, frontmatter: description+model+tools+name
│       ├── skills/avvarre/SKILL.md           # name matches folder, description non-empty
│       ├── hooks/avvarre/                    # README.md (name+desc+tags frontmatter) + hooks.json + 4 scripts
│       └── plugins/avvarre/.github/plugin/plugin.json + README.md  # awesome-copilot inline format
└── codebase_test/           # Test files with intentional violations
```

---

## Distribution Strategy

| Channel | Purpose | Status |
|---------|---------|--------|
| **npm** (`avvarre`) | Primary distribution — MCP server users install via `npx` | **v0.5.1 LIVE** |
| **github/awesome-copilot** | Discovery — agent, skill, hooks live inline in their repo | PR files ready in `marketing/awesome-copilot/` |
| **GitHub** (`PralhadYadawad/avvarre`) | Public-facing repo — source + 3 plugins + beautiful README | `avvarre/` folder ready to push |
| **GitHub** (`PralhadYadawad/avvarre_workspace`) | Private working repo — full codebase, test files, website | Active |

**How awesome-copilot works:** Agent plugin content (agent.md, SKILL.md, hooks.json) lives inside their repo. The actual MCP server stays on npm. Users find avvarre on awesome-copilot, then configure the MCP server themselves via `npx -y avvarre@latest` in their mcp.json.

**Key constraint:** awesome-copilot rejects plugins that auto-download external code. Our agent.md submitted there has NO `mcp-servers` frontmatter — MCP setup is documented as a user prerequisite in the plugin README.

### npm Package

```
name: avvarre
version: 0.5.1 (0.5.2 pending — install subcommand not yet published)
bin: avvarre, avvarre
files: dist/, cursor-plugin/, claude-plugin/, awesome-copilot/, opencode-plugin/, README.md, LICENSE, CLAUDE.md, .cursorrules, .env.example
```

> **DRIFT WARNING:** `src/ecosystem/install.ts`, `src/index.ts`, `src/server.ts` are uncommitted. The `npx avvarre@latest install` command advertised in README/website returns an error when installed from npm. Publish v0.5.2 to fix.

---

## Key Decisions

1. **MCP over VS Code Extension API** — IDE-agnostic, works in Cursor/Claude Desktop/VS Code
2. **Regex first, AST second, AI third** — instant value with zero config, AI is opt-in
3. **One server, all languages** — single process, `engine.ts` dispatches by language param
4. **Hardened tokenizer** — strips comments/strings before regex to eliminate false positives
5. **`.avvarre/` committed to git** — cross-machine, cross-developer persistent memory
6. **Graceful degradation** — no API key? regex-only. AI fails? fallback. File too large? auto-chunk.
7. **npm for distribution, awesome-copilot for discovery** — MCP server on npm, Copilot integration layer on awesome-copilot
8. **No auto-download in shared plugins** — agent.md on awesome-copilot references tool names only, user configures MCP server separately
9. **SQLite DB planned for .avvarre/graph.db** — Phase 1: file_scans (SHA-256 hash) + violations tables for incremental scanning and violation persistence. Phase 2: nodes + edges AST graph for blast-radius and dead code detection. DB is gitignored, no external server, uses better-sqlite3 or Node 22 native sqlite.

---

## Procedures

**Add a new language:**
1. Read the Google Style Guide → plan sessions (2 sections each) → create `rules/<lang>.ts` → implement `getCleanLines` tokenizer → wire into engine/scorer/scanner/server → add test files → regression test → add AI prompt → document in tasks.md

**Add a slash command:**
1. Create `cursor-plugin/commands/<name>.md` with YAML frontmatter → write prompt body referencing MCP tools → test locally

**Add a hook:**
1. Create script in `scripts/hook-<name>.cjs` → reads JSON from stdin (cwd, session_id, etc.) → outputs JSON to stdout → register in `~/.claude/settings.json` (nested format with matcher) AND `cursor-plugin/hooks/hooks.json` (flat format) AND `claude-plugin/hooks/hooks.json` (nested)

**Hook system architecture:**
- 4 hooks: Bootstrap (SessionStart), Context Loader (SessionStart), Skill Suggest (SessionStart), Session End (Stop)
- Stop hook is two-phase: phase1 blocks Claude and reminds to update .avvarre/ files, phase2 (stop_hook_active=true) logs the full session
- Skill Suggest hook: 3-layer stack detection (manifests→configs→extensions), per-skill decline via `.declined.json`, never re-asks declined skills
- Session log format: `## YYYY-MM-DD` → `### dev — HH:MM (session_id)` with user requests, agent actions, files created/changed with diffs, commands run
- Transcript parsing supports both Claude Code (nested .message) and Copilot (flat) JSONL formats
- Fallback chain: transcript → git diff → filesystem scan (2hr window, depth 4)
- Scripts use `.cjs` extension because project has `"type": "module"` in package.json

**Update ecosystem files:**
1. Session log: auto-updated by Stop hook → Tasks: use compressed format `[x] Summary (steps: a→b→c)` → Context: update only on scope/stack changes → Conventions: update on team agreement
