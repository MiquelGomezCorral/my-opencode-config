# Workflow

## Setup

Run `./bootstrap.sh` on macOS or Ubuntu/Debian. Authentication remains manual.

## Build

The installer builds the pinned OpenCode Quota fork and installs config package dependencies.

## Test

Run `bash -n bootstrap.sh`, `./bootstrap.sh --check`, and an isolated-home bootstrap with `--skip-deps --skip-services`.

## Commit And PR

Inspect status and diff, scan for secrets and absolute user paths, then use Conventional Commits. Push only after explicit approval.
