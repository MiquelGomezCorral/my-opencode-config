# my-opencode-config

Private, versioned backup of the complete OpenCode configuration. It restores global rules, permissions, agents, commands, skills, plugins, MCP definitions, TUI settings, BTCA resources, and supporting local services on macOS or Ubuntu/Debian.

## Install

Prerequisite: authenticate GitHub for this private repository with SSH or another Git credential method.

```bash
git clone git@github.com:MiquelGomezCorral/my-opencode-config.git ~/code/my-opencode-config
cd ~/code/my-opencode-config
./bootstrap.sh
```

The installer backs up conflicting managed paths with a timestamp, symlinks managed entries into `~/.config/opencode` and `~/.agents`, installs the required CLIs, builds the maintained OpenCode Quota fork, and starts the local SearXNG service.

Restart the shell after installation, then authenticate providers and remote MCP servers:

```bash
opencode auth login
opencode mcp auth <name>
gh auth login
```

Credentials and sessions are deliberately not backed up.

## Update

```bash
cd ~/code/my-opencode-config
git pull --ff-only
./bootstrap.sh
```

Existing symlinks follow repository updates immediately. Re-running the installer also restores newly added paths and pinned dependencies.

## Check

```bash
./bootstrap.sh --check
./bootstrap.sh --check-deps
```

Use `--skip-deps` or `--skip-services` when system dependencies or Docker are managed separately. `--home PATH` installs into an isolated home for testing.

OpenCode-facing runtimes and packages are pinned, including OpenCode, Bun, uv, BTCA, Headroom, CodeGraph, SkillSpector, MCP packages, OpenCode Quota, and the SearXNG image. Homebrew and apt install the current compatible platform toolchain packages.

SearXNG binds only to loopback. Bootstrap intentionally rotates its ephemeral cookie-signing secret on rerun rather than writing a credential to disk; this configuration does not preserve SearXNG browser sessions.

## Included

- `config/`: canonical `~/.config/opencode` files and directories.
- `agent-home/`: canonical global agent-compatible skills from `~/.agents`.
- `.agents/`: project memory and project-only skills for this repository.
- `tool-config/`: non-secret configuration for OpenCode's supporting CLIs.
- `bootstrap.sh`: idempotent macOS and Ubuntu/Debian installer.

The vendored Ponytail source is based on `687c1b339872289d70f65c5eaabce850b1663867`. Vault Context is based on `d396684a6958f97d8032e7e2dc4cfbdb6f0b0d0b` with the local portable configuration. OpenCode Quota is cloned and built at `ae4d944e56351a8dbeb8fd10aadbf6f079778741`.

## Never Commit

- `.env` files or shell credentials.
- `~/.local/share/opencode/auth.json` or `mcp-auth.json`.
- Session databases, logs, caches, prompt history, or tool output.
- Generated `node_modules` or nested plugin Git repositories.
