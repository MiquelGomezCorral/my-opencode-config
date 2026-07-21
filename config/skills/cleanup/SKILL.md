---
name: cleanup
description: Post-implementation cleanup gate for non-trivial or visibly AI-generated diffs. Use before final verification to remove unnecessary type declarations, redundant code, and obsolete paths without broad refactoring.
---

# Post Task Cleanup

## When to use

- Post-implementation, before final verification, when the diff is non-trivial or shows cleanup risk.
- The current task diff needs a focused cleanup pass for unnecessary type declarations, redundant code, and legacy code.
- Skip trivial one-line changes that have nothing to simplify.

## Overview

Run this skill after implementation work and before the final response. Treat it as a scoped cleanup gate over the task diff, not as permission for broad refactoring.

## Skill Composition

- Load and apply `deslop` first for AI-generated comments, abnormal defensive code, type-bypassing casts, and avoidable nesting.
- Then run this skill's type, redundancy, and legacy passes. Do not repeat edits already covered by `deslop`.

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
- Add or update the smallest regression check required by changed non-trivial logic; otherwise do not broaden test scope during cleanup.

4. Verify only what supports the final claim:
- Run the relevant repo verification commands before claiming the cleanup is complete.
- Run known repository checks as separate Bash calls when the runner hangs in non-interactive shells. See the `commit-push-pr` skill for repository-specific guidance.
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
