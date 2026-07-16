# PR Body Template

Use this structure when drafting PR metadata for shipped work. It is the canonical mirror of `.github/PULL_REQUEST_TEMPLATE.md`; keep both in sync. The first section must be readable by Product, Marketing, Success, and Support without code context.

The four sections below (`Brief`, `Product Summary`, `Verification`, `Technical Notes`) are fixed and always present, in this order, for every author. `Evidence` is the only optional section — include it when the change is validated by data, omit it otherwise.

## Title

- Use conventional commits format, but make the subject describe the product outcome: `<type>(<scope>): <customer-facing outcome>`.
- Avoid generic titles. Use a descriptive theme that reads at a glance.
- Keep under ~70 characters.

Examples:

- `feat(app): add shareable course preview links`
- `fix(studio): clarify module export progress`

## Sections

### Brief

- **What changed:** Customer-facing description in plain language.
- **Who it affects:** Primary users, teams, or workflows.
- **Why it matters:** Benefit, friction removed, or risk reduced.
- **Launch notes:** Screenshots, demo URL/path, rollout caveats, copy changes, or `None`.
- **Not included:** Related expectations this PR does not satisfy.

If brief context is not provided, infer conservatively from the diff and mark unknowns as `Not provided`; do not invent claims.

### Product Summary

2-4 bullets describing behavior changes, UX/API surface, and important constraints.

### Verification

What was run to prove the change works. Include exit status and key counts (file count, success/fail).

Examples:

- `bun typecheck`: passed (53 successful tasks).
- `bun format`: 1352 files checked, no fixes applied.
- pre-commit hooks: lint-staged, ts-safety-check (414 files), knip, manypkg passed.

### Technical Notes

Short implementation summary grounded in the diff. Avoid overexplaining internals. For bugfixes, lead with Problem → Root cause → Fix.

### Evidence

Optional. Include only when the change is validated by data: eval tables, Braintrust experiment links, traces, and honesty notes (run-to-run variance, caveats, intermediate failures). Omit the heading entirely when there is nothing to show. This is where deep validation lives without bloating the fixed sections.

### Commits

Include only when commit history adds useful review context. Omit for single-commit PRs or noisy commit history.

List commits with short SHA and one-line title when useful.

## Optional sections

### Context

Background that does not fit Summary (cross-PR notes, reverts, follow-ups).

### Test plan

Checklist for manual verification when applicable.
