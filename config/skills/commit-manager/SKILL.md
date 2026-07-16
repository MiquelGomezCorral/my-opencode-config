---
name: commit-manager
description: "Groups git changes by logical purpose and commits them sequentially. Use when user runs /commit, asks to commit changes, or wants to review, group, and commit git changes."
---

# Commit Manager

Groups changes by purpose, NOT by file. One commit = one logical change.

## Grouping rules

1. Group by purpose, not by file — multiple files may belong to the same commit.
2. Never mix unrelated changes in the same commit.
3. Prefer many small coherent commits over one large commit.
4. Each commit must be independently understandable and reversible.
5. Use `git add -p` for partial staging when a file contains multiple logical changes.
6. Strip all Jupyter notebook outputs before staging `.ipynb` files — run `jupyter nbconvert --ClearOutputPreprocessor.enabled=True --inplace <file>` or `nbstripout <file>` on each notebook.

## Commit order

1. `style` — formatting / whitespace
2. Renames / moves
3. `refactor` — code changes without behavior change
4. `fix` — bug fixes
5. `perf` — performance improvements
6. `feat` — new features
7. `test` — adding or modifying tests
8. `docs` — documentation
9. `chore` — maintenance, config, build

## Commit message format

```
<type>: <short description>
```

Types:
| Type | Purpose |
|------|---------|
| `feat` | New functionality |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting / whitespace (no logic change) |
| `refactor` | Code change without behavior change |
| `test` | Add or modify tests |
| `chore` | Maintenance, config, build tasks |

## Workflow

1. Run `git status` and `git diff` to see all changes.
2. Present a plan: list proposed commit groups with their files/changes.
3. Ask user to confirm or adjust the plan.
4. Before staging `.ipynb` files, strip outputs with `jupyter nbconvert --ClearOutputPreprocessor.enabled=True --inplace <file>` or `nbstripout <file>`.
5. Stage and commit each group sequentially.
6. Never commit secrets, env files, or large binaries.
7. Do not push unless explicitly requested.
