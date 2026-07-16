# Conventions

## Code Style

Use portable Bash with `set -euo pipefail`. Keep configuration changes minimal and valid JSON.

## Naming

Use OpenCode's plural global directories: `agents`, `commands`, `plugins`, and `skills`.

## Imports

Use `{env:HOME}` in OpenCode JSON and `$HOME` in shell-backed command files. Never hard-code a username or home path.

## Tests

Run `bash -n bootstrap.sh`, `./bootstrap.sh --check`, existing plugin tests, and an isolated-home bootstrap before publishing.
