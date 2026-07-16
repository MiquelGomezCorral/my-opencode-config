---
name: cleanup
description: Post-implementation cleanup gate for current diffs. Use after the agent completes a coding task, bug fix, refactor, or review fix and needs an individual pass to avoid unnecessary type declarations, remove redundant code, and delete legacy or obsolete code before final verification.
---

# Post Task Cleanup

## When to use

- Post-implementation, before final verification — after a coding task, bug fix, refactor, or review fix.
- The current task diff needs a focused cleanup pass for unnecessary type declarations, redundant code, and legacy code.
- Before claiming work is complete and ready to ship.

## Overview

Run this skill after implementation work and before the final response. Treat it as a scoped cleanup gate over the task diff, not as permission for broad refactoring.

## Workflow

1. Identify the task surface:
- Check `git status --short`.
- Inspect the staged diff first; if nothing is staged, inspect the unstaged diff.
- Limit cleanup to files touched by the task unless an adjacent file is necessary to remove an obsolete caller or export.

2. Run the three cleanup passes individually:
- Pass 1: avoid unnecessary type declarations.
- Pass 2: remove redundant code.
- Pass 3: remove legacy code.

3. Apply focused edits:
- Make the smallest code changes that satisfy each pass.
- Prefer deleting code over preserving compatibility layers when there is no live caller.
- Do not add abstractions unless they remove meaningful duplication already present in the task diff.
- Do not add, update, or run tests unless the user explicitly requested test work.

4. Verify only what supports the final claim:
- Run the relevant repo verification commands before claiming the cleanup is complete.
- In this repo, the normal completion gate is `bun typecheck` and `bun format`. Run them as **separate Bash calls**, never chained with `&&` — turborepo's TUI hangs in non-interactive shells. See `.agents/skills/commit-push-pr/SKILL.md` for the rule.
- If the cleanup touches studio agent domain-modeling code, also run `bun run typecheck:studio-domain`.
- Read the full output and only report success when the commands confirm it.

## Pass 1: Avoid Type Declarations

Remove manual type declarations when TypeScript can infer the type from source code, package exports, schema objects, constants, or function implementations.

Check for:
- Type aliases or interfaces that only annotate a single function return.
- Explicit return types on internal functions where the implementation is clear.
- Literal unions duplicated from constants instead of derived from `as const` data.
- Drizzle row or insert shapes written manually instead of inferred from schema.
- Package types re-declared locally instead of imported from package exports.
- Local variable annotations that simply restate the initializer.
- Redundant generic arguments that TypeScript can infer from function arguments.

Keep explicit types when they protect a real public API boundary, encode a non-obvious constraint, preserve narrowing semantics, or work around a concrete compiler limitation.

## Pass 2: Remove Redundant Code

Remove code that repeats behavior without improving clarity, correctness, or reuse.

Check for:
- Duplicate branches, helpers, schemas, mapping logic, or normalization steps.
- Pass-through wrappers whose names do not add a real boundary or abstraction.
- Repeated literals that should be derived from an existing constant.
- Conditional logic that computes the same result on multiple paths.
- Object cloning, spreading, or remapping that does not change the value meaningfully.
- New abstractions with only one caller and no concrete boundary reason.

Prefer simple composition using nearby existing helpers. Do not invent shared utilities for one-off code.

## Pass 3: Remove Legacy Code

Delete obsolete code left behind by the task.

Check for:
- Old wrappers, adapters, aliases, flags, or translation helpers replaced by the new path.
- Dual old/new code paths without an active migration reason.
- Deprecated fallbacks and stale compatibility branches.
- Unused exports, callers, files, config keys, constants, and comments.
- Dead TODOs or documentation describing behavior that no longer exists.
- Imports left unused after cleanup.

Only preserve legacy behavior when the diff shows a live caller, active migration, external API contract, or explicit user requirement.

## Reporting

In the final response, briefly state:
- Which cleanup passes changed files.
- Which files were changed.
- Which verification command ran and its result.

If no cleanup was needed, say that the pass found no changes and still report any verification that was run.
