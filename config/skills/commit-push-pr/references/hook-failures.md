# Hook Failure Signals

Pre-commit hooks are a hard gate. If any hook fails, stop — do not push or create the PR.

## Husky general signal

```
husky - pre-commit script failed (code N)
```

The exit code identifies which hook failed. Inspect the surrounding output to find the offending check.

## Common hooks in this repo

| Hook | What it runs | Failure means |
|---|---|---|
| `lint-staged` | biome on staged files | Style or lint error in a staged file. Run `bun format` to auto-fix where possible. |
| `bun scripts/quality/ts-safety-check.ts` | Custom agent type-inference and safety checks | Banned type pattern in agents code. Read the violation list and fix at the source. |
| `bunx knip` (`lint:imports`) | Unused dependencies, exports, files | Repo-wide dep hygiene. Sometimes flags pre-existing issues unrelated to the diff. |
| `bunx manypkg check` | Workspace package consistency | Missing or inconsistent fields across `package.json` files. |
| `bun typecheck` (when staged includes TS) | TypeScript across affected workspaces | Type error. Read the failing task output and fix. |

## What NOT to do

- Never use `--no-verify` to skip a hook unless the user explicitly authorizes it for a specific commit.
- Never amend a failed-hook commit — the commit didn't happen. Fix, re-stage, create a new commit.

## When to ask for `--no-verify` authorization

Only ask when the failing hook reports a pre-existing repo-wide issue clearly unrelated to the current diff (for example, knip flagging unused deps from other packages on a markdown-only PR). Document the reason in the commit message and the PR body.
