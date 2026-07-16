---
name: review
description: Two-phase engineering review for correctness and conventions. Use when the user asks for a code review, quality gate, staff review, or convention audit of current diffs.
---

# Review Gate

## When to use

- User asks for "review", "audit", or "quality gate".
- You need a rigorous diff review before merge.
- You need conventions checks plus optional auto-fixes.

## Modes

- `full` (default): staff review + convention audit.
- `quick`: convention audit only.
- `deep`: staff review only, no auto-fix.

## Skill Composition

- If the diff touches `Effect`, `Layer`, `Schedule`, `Schema.TaggedErrorClass`, `ServiceMap`, `ManagedRuntime`, `createEffectTool`, or `createEffectRunner`, also load and apply the `effect` and `btca-first` skills, and use [references/effect-checks.md](references/effect-checks.md).
- Use `effect` for repo-local conventions and `btca-first` with `effect-smol` when the review depends on current API behavior or recommended usage.

## Workflow

1. Gather review context:
- Current branch.
- Staged diff first; if empty, use unstaged diff.

2. Phase 1: Staff review (skip in `quick`):
- Correctness, security, performance, maintainability, testing.
- Ask probing questions for risky or unclear logic.
- Produce verdict:
  - `Block`
  - `Request changes`
  - `Approve with comments`
  - `Approve`

3. Phase 2: Convention audit (skip in `deep`):
- Only files in current diff.
- Treat this as a quality gate, not a style-only checklist.
- Check and report:
  - TypeScript hygiene (`any`, `interface`, `import type`).
  - Type inference anti-patterns — see [references/type-inference-checks.md](references/type-inference-checks.md).
  - Legacy and unnecessary code — see [references/legacy-checks.md](references/legacy-checks.md).
  - Effect-specific patterns when the diff touches Effect code — see [references/effect-checks.md](references/effect-checks.md).
  - React/mutation patterns.
  - Over-engineering cleanup.
  - Naming and JSDoc conventions.
  - Dead code (`bunx knip --reporter compact`) when relevant.

4. Fix pass (only if requested):
- Ask whether to fix all, a category, or skip.
- Apply approved fixes.
- Run `bun typecheck` and `bun format` as **separate Bash calls** (turborepo's TUI hangs when chained with `&&`).

## Output format

1. Findings first, ordered by severity, with file references.
2. Open questions and assumptions.
3. Label convention findings clearly as `Type inference`, `Legacy cleanup`, `Unnecessary abstraction`, `Effect pattern`, or `General conventions`.
4. If fixes applied: list files changed + verification results.

## Guardrails

- Prioritize bugs, regressions, and security risks over style.
- Do not audit unrelated files.
- Do not auto-fix without explicit user direction.
- Prefer deletion over preservation when code is legacy, duplicated, or no longer needed.
- Do not keep compatibility layers, wrappers, or fallback branches without a concrete live caller or active migration reason in the diff.
