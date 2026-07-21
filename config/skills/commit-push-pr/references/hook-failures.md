# Hook Failure Signals

Pre-commit hooks are a hard gate. If any hook fails, stop — do not push or create the PR.

## Husky general signal

```
husky - pre-commit script failed (code N)
```

The exit code identifies which hook failed. Inspect the surrounding output to find the offending check.

Read the repository's hook configuration and full failure output. Fix the reported source, re-stage only the intended files, and create a new commit.

## What NOT to do

- Never use `--no-verify` or another hook-bypass flag.
- Never amend a failed-hook commit — the commit didn't happen. Fix, re-stage, create a new commit.

If a hook exposes a pre-existing unrelated failure, report the blocker instead of bypassing it.
