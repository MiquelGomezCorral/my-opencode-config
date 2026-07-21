# Conventions

## Code Style

Use portable Bash with `set -euo pipefail`. Keep configuration changes minimal and valid JSON.

## Naming

Use OpenCode's plural directories: `agents`, `commands`, `plugins`, and `skills`. Keep reusable skills in `config/skills`, cross-agent skills in `agent-home/skills`, and repository-only skills in `.agents/skills`.

## Imports

Use `{env:HOME}` in OpenCode JSON and `$HOME` in shell-backed command files. Never hard-code a username or home path.

## Tests

Run `bash -n bootstrap.sh backup.sh`, `./bootstrap.sh --check`, existing plugin tests, skill inventory validation, and an isolated-home bootstrap before publishing.
