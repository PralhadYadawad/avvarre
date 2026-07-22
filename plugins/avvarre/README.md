# Avvarre for Codex

Avvarre adds persistent project memory, local style-guide analysis, optional AI review, workspace quality scans, PR checks, dependency-impact warnings, and memory gardening to Codex.

## Local development

This repository includes a marketplace at `.agents/plugins/marketplace.json` that exposes this plugin from `plugins/avvarre/`. Open the repository in the ChatGPT desktop app, restart the app, choose the **Avvarre Plugins** marketplace, and install **Avvarre**.

Codex copies installed local plugins into its cache. After changing this plugin, update its Codex cachebuster and reinstall it before testing in a new thread.

## What is included

- Avvarre's stdio MCP server, started with `npx -y avvarre@latest`
- Skills for file review, initialization, workspace audit, PR gates, autopilot, memory gardening, and reviewer workflows
- Session-start project context, pre-edit impact warnings, and session-end memory reminders

Codex requires a one-time review and trust decision before plugin hooks run. The MCP tools and skills continue to work if hooks are disabled.

## Configuration

Avvarre works with local rules by default. To enable optional AI review, configure its standard `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` environment variables for the MCP server, or configure Gemini with `AI_PROVIDER=gemini` and `GEMINI_API_KEY`.
