---
name: customize-opencode
description: "Use ONLY when editing or creating opencode's own config: opencode.json, skills, commands, agents, plugins, MCP servers, instructions, permissions, security rules. Not for application code. Trigger on 'configure opencode', 'opencode setup', 'add skill to opencode', 'update opencode config', 'opencode plugin'."
---

# Customize opencode

Configuring opencode itself. Not for application code.

## Workflow

1. Understand — read existing config, check vault for current setup
2. Propose — brief plan with files to change, wait for confirmation
3. Apply — surgical edits, validate JSON
4. Update vault — always update `setup.md` + relevant files in `CODE/LLMs/`
5. Verify — check validity, tell user to restart if needed

## Vault sync rules

| Change | Vault file |
|--------|-----------|
| Any config change | `CODE/LLMs/opencode/setup.md` |
| New skill | `CODE/LLMs/Skills/<name>.md` |
| New command | `CODE/LLMs/Commands/<name>.md` |
| New agent | `CODE/LLMs/Agents/<name>.md` |
| New instruction | `CODE/LLMs/Instructions/<name>.md` |
| Plugin change | `CODE/LLMs/Plugins/<name>.md` |
| Model change | `CODE/LLMs/LLMs.md` |
| MCP change | `CODE/LLMs/MCP/<name>.md` |

## Never document

API keys, tokens, auth cookies, workspace IDs, private keys, OAuth secrets.

## Config reference

| File | Purpose |
|------|---------|
| `opencode.json` | Main config |
| `AGENTS.md` | Global agent instructions |
| `security-rules.md` | Credential + injection protection |
| `opencode-quota/quota-toast.json` | Quota UI |
| `skills/<name>/SKILL.md` | Local skills |
| `commands/<name>.md` | Slash commands |
| `agents/<name>.md` | Agent definitions |
