# Project Agent Rules

This repository is the canonical, secret-free OpenCode configuration backup.

## Memory Files

- `.agents/architecture.md` - layout and boundaries.
- `.agents/conventions.md` - portability and security rules.
- `.agents/decisions.md` - closed implementation decisions.
- `.agents/glossary.md` - project-specific terms.
- `.agents/workflow.md` - setup, checks, and publishing flow.
- `.agents/known-errors.md` - recurring bootstrap failures.

## Load Rules

- Load only memory relevant to the current task.
- Trust current code over stale memory and flag conflicts.
- Never add credentials, auth state, sessions, caches, or machine-specific absolute paths.

## Project Notes

- Stack: Bash, JSON, JavaScript, Markdown, Docker Compose.
- Package managers: Bun, npm, pnpm, uv.
- Main commands: `./bootstrap.sh --check`, `./bootstrap.sh --home <path> --skip-deps --skip-services`.
