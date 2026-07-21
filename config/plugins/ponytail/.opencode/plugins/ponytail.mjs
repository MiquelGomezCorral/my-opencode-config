// ponytail — OpenCode plugin.
//
// Injects the ponytail ruleset into every chat's system prompt at the active
// intensity, and persists /ponytail mode switches. Reuses the shared instruction
// builder so Claude Code, Codex, pi, and OpenCode all read one source of truth.
//
// OpenCode loads this as a server plugin — add it to your opencode.json:
//   { "plugin": ["./.opencode/plugins/ponytail.mjs"] }

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The shared instruction builder is CommonJS; bridge to it from this ES module.
const require = createRequire(import.meta.url);
const { getPonytailInstructions } = require('../../hooks/ponytail-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/ponytail-config');

const commands = {
  ponytail: {
    description: 'Set Ponytail mode',
    template: 'Ponytail mode: $ARGUMENTS. Confirm the selected mode in one sentence; it applies from the next message.',
  },
  'ponytail-review': {
    description: 'Review the current diff for over-engineering',
    template: 'Review the current changes for over-engineering only, not correctness. Report each deletion or simplification with its path, then the net lines removable. If nothing can be cut, say "Lean already. Ship." User context: $ARGUMENTS',
  },
  'ponytail-audit': {
    description: 'Audit the repository for over-engineering',
    template: 'Audit the entire repository for over-engineering only, not correctness. Rank deletions and simplifications by impact, include each path, then the net lines and dependencies removable. If nothing can be cut, say "Lean already. Ship." User context: $ARGUMENTS',
  },
  'ponytail-debt': {
    description: 'List deliberate Ponytail shortcuts',
    template: 'Find every `ponytail:` comment in the repository and report its path, ceiling, and upgrade trigger. Flag comments without a trigger, summarize the counts, and change nothing. User context: $ARGUMENTS',
  },
  'ponytail-help': {
    description: 'Show Ponytail modes and commands',
    template: 'Show the Ponytail reference card: modes off, lite, full, and ultra; commands /ponytail-review, /ponytail-audit, /ponytail-debt, and /ponytail-help. Change nothing.',
  },
};

// OpenCode has no flag-file convention of its own; keep mode beside its config.
const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.ponytail-active',
);

function readMode() {
  try {
    return normalizePersistedMode(fs.readFileSync(statePath, 'utf8').trim()) || getDefaultMode();
  } catch (e) {
    return getDefaultMode();
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

export default async ({ client } = {}) => {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'ponytail', level, message } }); } catch (e) {}
  };

  return {
    config: async (config) => {
      config.command ??= {};
      for (const [name, command] of Object.entries(commands)) {
        config.command[name] ??= command;
      }
    },

    // Append the ruleset to the system prompt every turn.
    'experimental.chat.system.transform': async (_input, output) => {
      const mode = readMode();
      if (mode === 'off') return;
      output.system.push(getPonytailInstructions(mode));
    },

    // Persist `/ponytail <level>` so the next turn's injection follows it.
    // ponytail: mode applies from the next message, not the current one — the
    // transform reads the flag the command writes. Good enough; switch to a
    // synchronous store if same-turn switching ever matters.
    'command.execute.before': async (input) => {
      if (!input || input.command !== 'ponytail') return;
      // `off` is persisted like any mode; the transform reads it and stays silent.
      const mode = normalizePersistedMode((input.arguments || '').trim()) || getDefaultMode();
      writeMode(mode);
      log('info', 'ponytail ' + mode);
    },
  };
};
