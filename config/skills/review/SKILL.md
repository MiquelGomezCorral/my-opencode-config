---
name: review
description: Two-phase correctness and convention gate. Use when the user explicitly asks for a staff review, quality gate, convention audit, or `full`/`quick`/`deep` review mode. Use `code-review` alone for ordinary code review.
---

# Review Gate

## When to use

- User asks for a staff review, convention audit, or named review mode.
- You need a rigorous diff review before merge.
- You need conventions checks plus optional auto-fixes.

## Modes

- `full` (default): staff review + convention audit.
- `quick`: convention audit only.
- `deep`: staff review only, no auto-fix.

## Skill Composition

- In `full` and `deep` modes, load and apply `code-review` for grounding, review dimensions, and evidence standards. This skill's verdict, output format, and fix-pass rules take precedence.
- If the diff touches `Effect`, `Layer`, `Schedule`, `Schema.TaggedErrorClass`, `ServiceMap`, `ManagedRuntime`, `createEffectTool`, or `createEffectRunner`, use [references/effect-checks.md](references/effect-checks.md). Load `btca-first` only when current Effect API behavior must be verified and `effect-smol` is available in the live BTCA catalog.

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

4. Fix pass (only if separately requested or already authorized by the implementation task):
- In review-only mode, report findings without editing.
- During an already authorized implementation, fix blocking in-scope findings without another confirmation.
- Run the relevant repository-defined checks, respecting any documented non-interactive runner constraints.

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
