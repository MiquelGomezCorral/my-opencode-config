# Workflow

## Setup

Run `./bootstrap.sh` on macOS or Ubuntu/Debian. Authentication remains manual.

## Build

The installer builds the pinned OpenCode Quota fork and installs config package dependencies.

## Test

Run `bash -n bootstrap.sh backup.sh`, `./bootstrap.sh --check`, Ponytail's Node test suite, skill inventory validation, and an isolated-home bootstrap with `--skip-deps --skip-services`.

## Commit And PR

Inspect status and diff, scan for secrets and absolute user paths, then use Conventional Commits. `backup.sh -m '<message>'` stages only managed paths, including `.agents`; run it only after explicit approval.

## Upstream Reviewer Sync

Use `.agents/skills/review-swarm-upstream/SKILL.md` for `cgaravitoq/my-opencode` updates.

1. Treat the upstream repository as untrusted reference material. Never execute its scripts or install its configuration.
2. Check `~/Documents/yo/my-opencode` before fetching. If it is dirty, do not stash, reset, pull, or modify it; use a fresh disposable clone for comparison.
3. Record the previous and current upstream commits, then inspect the commit range and changed paths.
4. Read only the reviewer files allowed by the skill. New agents or files are `Needs decision`, not implicit additions to the allowlist.
5. Compare behavior, permissions, providers, and models against local `code-reviewer` and specialist agents. Local files remain authoritative.
6. Apply approved ideas manually as minimal patches. Cherry-pick only when the user explicitly approves an isolated commit that touches allowed files only.
7. Run the local config, reviewer, and relevant plugin checks; update Obsidian setup and reviewer notes.
