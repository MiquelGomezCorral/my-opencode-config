---
name: swarm-review
description: Multi-model parallel code review. Use when the user asks to review, audit, or get a second opinion on recent code changes. Delegates to four DeepSeek reviewer subagents in parallel, then consolidates findings into a prioritized summary.
license: MIT
metadata:
  author: cgaravitoq
  version: "1.0"
---

# Swarm Review

Run a parallel, multi-model code review on recent changes by delegating to four specialized reviewer subagents. The point of the swarm is **diversity of blind spots**: each reviewer has a narrow specialty and the roster mixes DeepSeek V4 Flash (fast smoke pass) with V4 Pro (deeper reasoning), so they catch issues a single pass misses.

## When to use

Activate this skill when:

- The user explicitly asks for a review, audit, or second opinion on code.
- The user just received an implementation from you and wants validation.
- You finished a non-trivial change (new feature, refactor across multiple files, tricky logic) and want diverse perspectives before declaring done.
- The user asks "what did I miss?" or "review what I just did".

## When NOT to use

- Cosmetic changes (formatting, renames, comments). Burns Go quota for no value.
- Single-line fixes or trivial typo corrections.
- Code the user is still actively writing — wait until they pause.
- When the user asked a research/explanation question, not a review.

If unsure, ask: "Want me to run the swarm review on this?" rather than burning quota silently.

## Reviewer roster

Four read-only subagents are available via the `task` tool. None of them can write or edit files — they only analyze and report.

| Subagent | Model | Lab | Specialty |
|---|---|---|---|
| `reviewer-quick` | DeepSeek V4 Flash | DeepSeek | Fast first-pass: obvious bugs, typos, copy-paste errors, dead code |
| `reviewer-arch` | DeepSeek V4 Pro | DeepSeek | Architecture, design patterns, module boundaries, abstractions |
| `reviewer-reasoning` | DeepSeek V4 Pro | DeepSeek | Logic correctness, edge cases, error paths, race conditions |
| `reviewer-e2e` | DeepSeek V4 Pro (1M ctx) | DeepSeek | Cross-file impact, integration, breaking changes, side effects |

## Selection logic

Pick reviewers based on the change profile. Don't always run all four — match the tool to the work.

### Trivial change (one file, < 30 lines, simple logic)
Run `reviewer-quick` only. One sub-second pass is enough.

### Standard change (single feature, single module)
Run in parallel:
- `reviewer-quick`
- `reviewer-reasoning`

Skip `reviewer-arch` if no new abstractions/interfaces. Skip `reviewer-e2e` if no public API changes.

### Non-trivial change (multi-file, refactor, new abstractions, or public API changes)
Run all three deep reviewers in parallel:
- `reviewer-arch`
- `reviewer-reasoning`
- `reviewer-e2e`

Skip `reviewer-quick` — the deep ones already cover its scope.

### When user explicitly says "lanza el swarm completo" / "full swarm"
Run all four in parallel regardless of change size. User is paying for paranoia.

## Invocation pattern

Issue **multiple `task` calls with `background: true`** so they start immediately, then collect each result with `task_status(wait: true)`. Sequential blocking `task` calls waste wall-clock time and don't take advantage of the swarm.

Each `task` call should pass:

1. A short `description` (3-5 words) for the task list UI.
2. A `prompt` that includes:
   - What changed (point at files or paste the diff scope).
   - What to focus on (matching the reviewer's specialty).
   - Any context the reviewer needs that they can't get from `git diff` alone.
3. `background: true`.

After launch:

1. Save every returned `task_id`.
2. Call `task_status` for each task with `wait: true`.
3. Consolidate results only after all selected reviewers finish or report an error.

Example prompt body to pass to a reviewer:

```
Review the changes I just made to add ISO 8601 date parsing in src/utils/dates.ts and src/utils/dates.test.ts.

Diff scope: last commit (use `git diff HEAD~1`).

Focus on your specialty. Be specific with file:line citations. Use the output format from your system prompt.
```

Don't paste full file contents — reviewers can read with their own tools. Be concise; their context window is theirs to fill.

## Output consolidation

Reviewers return structured feedback (Findings + Severity + Confidence). Your job is to merge them into a single user-facing summary.

Steps:

1. **Collect** all reviewer outputs.
2. **Deduplicate**: if two reviewers raise the same issue, mention it once but credit both ("flagged by reviewer-arch and reviewer-reasoning").
3. **Prioritize** by severity, not by reviewer order:
   - Critical / Bugs first
   - Important / Likely bugs second
   - Minor / Nitpicks last
4. **Filter false positives**: if a reviewer flags something with Low confidence and you can verify it's a non-issue (because you wrote the code), drop it but mention it briefly so the user can override.
5. **Disagreements**: if reviewers contradict each other, surface the disagreement explicitly. Don't pick a side silently.

### Output template to present to the user

```
## Swarm Review Summary

Reviewers: <list which ones ran>

### Critical
- (issue) — flagged by <reviewer(s)> at file:line

### Important
- ...

### Minor
- ...

### Disagreements / Low confidence
- ...

### Verdict
<one sentence: "ship it", "fix critical first", "rethink approach", etc.>
```

After presenting the summary, **wait for the user** before applying any fixes. The reviewers report; the user decides; you implement.

## Cost awareness

OpenCode Go limits apply to all four reviewers (they all use DeepSeek through the `opencode-go` provider). The swarm runs four (or more) parallel sessions, each consuming context.

- A full 4-reviewer swarm on a medium-sized change typically costs $0.20-$0.80.
- Running it on every trivial change will exhaust the weekly cap fast.
- Prefer `reviewer-quick` alone when in doubt about whether a swarm is justified.

## Failure modes to avoid

- **Don't** invoke reviewers sequentially or without `background: true` — defeats the purpose.
- **Don't** paste massive code dumps into the reviewer prompt; they have their own read tools.
- **Don't** apply fixes from a reviewer without showing the user first. The reviewer might be wrong.
- **Don't** invoke reviewers for code you haven't yet committed/staged unless you tell them which files to look at — `git diff` won't show untracked files.
- **Don't** loop: if a reviewer flags something and you fix it, don't immediately re-run the swarm to validate the fix unless the user asks. That's how quota disappears.
