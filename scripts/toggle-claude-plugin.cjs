#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const PLUGIN_ROOT = path.resolve(__dirname, '..');

const HOOKS = {
  SessionStart: [
    {
      matcher: '',
      hooks: [{ type: 'command', command: `node "${PLUGIN_ROOT}/scripts/hook-bootstrap.cjs"` }]
    },
    {
      matcher: '',
      hooks: [{ type: 'command', command: `node "${PLUGIN_ROOT}/scripts/hook-context-loader.cjs"` }]
    },
    {
      matcher: '',
      hooks: [{ type: 'command', command: `node "${PLUGIN_ROOT}/scripts/hook-skill-suggest.cjs"` }]
    }
  ],
  Stop: [
    {
      hooks: [{ type: 'command', command: `node "${PLUGIN_ROOT}/scripts/hook-session-end.cjs"` }]
    }
  ]
};

const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
const currentHooks = settings.hooks || {};
const isEnabled = Object.keys(currentHooks).length > 0;

if (isEnabled) {
  settings.hooks = {};
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log('[avvarre] Claude Code plugin DISABLED — hooks removed.');
} else {
  settings.hooks = HOOKS;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
  console.log('[avvarre] Claude Code plugin ENABLED — 4 hooks active.');
}
