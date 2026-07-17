---
name: commit-push-pr
description: Stage changes, create a conventional commit, push the branch, and create or refresh PR metadata for shipped work. Use when the user asks to ship current work to GitHub.
---

# Commit Push PR

## When to use

- User asks to commit and push current changes.
- User asks to open a PR for current branch.
- User asks to checkpoint progress safely.

## Inputs expected

- Current working tree status.
- Optional guidance on commit scope or PR readiness.
- Brief context, when applicable:
  - Customer-facing change: what users will notice.
  - Audience: who this affects.
  - Value proposition: why this matters.
  - Launch/comms notes: screenshots, demo path, copy changes, rollout risk.
  - Non-goals: what this PR does not change.
- If brief context is not provided, infer conservatively from the diff and full conversation history. Mark unknowns as `Not provided`; do not invent claims.

## Skill Composition

- For shipped-work PR metadata, load and apply `make-pr-easy-to-review` for reviewer entry points, generated/mechanical-file separation, risk notes, and test guidance.
- Keep this skill's fixed PR body structure. Do not use the composed skill's history-rewrite workflow unless the user separately requests or approves it.

## Performance rules

- **Parallelize independent Bash calls.** Use multiple tool calls in a single response whenever commands have no data dependency.
- **Never chain turbo commands with `&&`.** `bun typecheck` uses turborepo whose TUI hangs in non-interactive shells. Run each command as its own Bash call.

## Workflow

1. **Gather context** (run all four in parallel):
   - `git status`
   - `git diff --stat`
   - `git log --oneline -5`
   - `gh pr list --head $(git branch --show-current) --json number,url --jq '.[0]'`

2. **Branch safety**: if on `main` or `staging`, create a descriptive feature branch. Otherwise continue.

3. **Stage changes precisely**: prefer `git add <files>` over blanket staging. Never stage secrets or `.env` files.

4. **Validation gate** — each command as a separate Bash call:
   - Shipped work: `bun typecheck`, `bun run typecheck:safety`, `bun format` (parallel). Stop on any failure.
   - WIP checkpoint: `bun run typecheck:safety` only. Stop on failure.

5. **Commit**:
   - Follow conventional commits from `docs/conventions/commits.md`.
   - Hook failure handling and signals: see [references/hook-failures.md](references/hook-failures.md).
   - Sandbox write denial during commit: see [references/sandbox-escalation.md](references/sandbox-escalation.md).

6. **Push**: push branch and set upstream when needed.

7. **Draft PR metadata** (shipped work only):
   - Analyze recent commits and any existing PR metadata.
   - Draft a conventional title from the dominant commit type/scope, with a subject that describes the product outcome.
   - Draft a body using the fixed structure shared by every author: `Brief` → `Product Summary` → `Verification` → `Technical Notes`, with an optional `Evidence` section for data-validated changes. This mirrors `.github/PULL_REQUEST_TEMPLATE.md`.
   - Always emit the four fixed sections in order regardless of change type; never substitute ad-hoc headings (`Problem`, `Fix`, `Goal`). Bugfix narrative goes inside `Technical Notes` as Problem → Root cause → Fix.
   - Ground customer-facing claims in user-provided brief context, existing PR metadata, conversation context, commits, and diff summary.
   - If launch context is unavailable, write `Not provided` or `None`; do not invent positioning.
   - Body structure and section guidance: see [references/pr-body-template.md](references/pr-body-template.md), kept in sync with `.github/PULL_REQUEST_TEMPLATE.md`.
   - Include a commit list only when commit history adds useful review context.

8. **PR handling** (shipped work only):
   - No PR exists: `gh pr create --draft --title ... --body ...`.
   - PR exists: `gh pr edit --title ... --body ...`.
   - WIP checkpoints: stop after push and report branch state.

## Output format

1. Branch and staging summary.
2. Commit hash and title.
3. Push result.
4. PR title and whether metadata was created or refreshed.
5. PR URL (created, updated, or "progress checkpoint only").

## Guardrails

- If no changes exist, report and stop.
- Do not perform destructive git operations.
- Do not amend or rebase unless explicitly requested.
- Do not create or refresh PR metadata for WIP checkpoints unless explicitly requested.
- For shipped work, treat PR metadata creation or refresh as part of the normal flow.
- Do not leave the PR body empty for shipped work; use brief context first, then existing PR metadata, commit history, and diff summary as fallback.
