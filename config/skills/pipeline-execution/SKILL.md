---
name: pipeline-execution
description: Drives the `exec → reviewer → fixer ×≤3 → draft PR` pipeline on a target repo. Use when the architect has a concrete task list, a target repo, and a parent branch. Tracker-agnostic.
license: MIT
metadata:
  author: cgaravitoq
  version: "1.0"
---

# Pipeline Execution

The single shared implementation pipeline. Agnostic of issue trackers, project boards, or status flows. Owns the contract:

> Given a target repo, a parent branch, a concrete task list, and an optional verify command — produce committed code on the parent branch, audited by the reviewer, fixed up to 3 times, and shipped as one draft PR with a `hitl` (clean) or `hitl-blocked` (loop exhausted) label.

Tracker-specific or workflow-specific bookkeeping (status updates, body checkboxes, comment timelines) is **not** this skill's job. A caller skill (e.g. a per-repo GitHub Issues bundle) wraps this skill and handles its own bookkeeping around it.

## When to use

Activate this skill from the `architect` whenever code work is ready to ship:

- The architect has confirmed the scope (GitHub Issues PRD plan, ad-hoc prompt, or any other source).
- The target repo is resolved and accessible locally.
- A parent branch name has been decided.
- The task list is concrete: each task has a `title`, `surface`, `output`, `depends-on`, and `verify`.

## When NOT to use

- The task is trivial (one-line fix, rename, doc tweak). Use the `coder` fast path instead.
- Scope is not yet confirmed. Resolve it first.
- The repo, branch, or task list is missing. Stop and report — do not guess.

## Required inputs

The architect (or caller skill) passes:

- `repo_path`: absolute local path to the target repo.
- `parent_branch`: name of the shared branch (created if missing on the first task).
- `tasks`: ordered list of task blocks. Each task must have:
  - `title`
  - `surface` (files / package / app / system area)
  - `output` (what must be committed)
  - `depends_on` (task title or `none`)
  - `verify` (command or manual flow for this task)
- `pr_title`: title for the draft PR (conventional commit format).
- `pr_summary`: one-line intent; goes in the PR body.
- Optional `verify_command`: PRD-level / scope-level verify run by the reviewer after the fixer loop closes.
- Optional `tracker_url`: link to the source artifact (GitHub issue URL, external tracker, etc.). Goes in the PR body if present.
- Optional `pr_label_clean`: defaults to `hitl`.
- Optional `pr_label_blocked`: defaults to `hitl-blocked`.
- Optional `change_profile_hints`: passed to the reviewer to bias swarm selection.

If any required input is missing, refuse to start. Do not invent values.

## Workflow

### 1. Pre-flight

- Verify `repo_path` exists and is a git repo with a remote.
- Verify the working tree is clean enough to start a new branch.
- Switch the working directory to `repo_path` via `workdir` (never `cd && cmd`).

### 2. Implementation phase — delegate to `exec`

For each task in `tasks`:

- Create or switch to `parent_branch` if not already on it.
- Delegate to `exec` via `task` with the task block, repo path, branch name, and (when applicable) the `tracker_url`.
- Multiple `exec` workers may run in parallel **only when their `surface` blocks are disjoint** and dependencies are satisfied.
- After `exec` returns, verify the reported commit hash exists on the parent branch (`git log --oneline -1 <hash>`). If missing, treat as a blocker and stop.

The architect (or wrapping skill) updates external bookkeeping (GitHub Issues, etc.) between `exec` calls — not this skill.

### 3. Pre-review verify gate

After all `exec` tasks committed, run `verify_command` over the combined change if one was provided. If it fails, stop and surface the failure to the caller. Do not proceed to the reviewer with broken code.

### 4. Review phase — delegate to `reviewer`

Call `reviewer` once via `task` with mode `pr` and:

- `repo_path`, `parent_branch`, commit range (`<base>..HEAD`).
- `pr_title`, `pr_summary`.
- `tracker_url` if provided.
- `verify_command` if provided (reviewer runs it as the final gate post-fixer).
- `change_profile_hints` if provided.
- `pr_label_clean` and `pr_label_blocked`.

The `reviewer` runs the swarm, drives the `fixer` loop (≤3 passes), runs the final verify gate, pushes the parent branch, and opens a single draft PR with `pr_label_clean` (clean) or `pr_label_blocked` (loop exhausted) label.

### 5. Output

Return a single report to the caller:

```
## Pipeline Execution Report

Repo: <repo_path>
Branch: <parent_branch>
Commits:
- <hash>: <task title>
- ...

### Review loop
- Passes: <N> of 3
- Swarm reviewers run: <list>
- Blockers per pass: pass1=<n>, pass2=<n>, pass3=<n>
- Resolved: <n>
- Remaining: <n>
- Verdict: clean | blocked

### PR
- URL: <draft pr url>
- Label: <hitl | hitl-blocked>

### Final verify
- <command> → pass | fail (output)

### Nits passed through
- [file:line] description

### Disagreements
- ...

### Notes for caller
- <anything the wrapping skill needs to record in its own bookkeeping>
```

## Hard constraints

- **Never push the parent branch directly.** Only the `reviewer` pushes (after the loop closes).
- **Never run `gh pr create` directly.** Only the `reviewer` opens or edits the draft PR.
- **Never invoke `reviewer-*` (raw swarm) or `fixer` from this skill.** The `reviewer` orchestrates them.
- **Never write to GitHub Issues or any external tracker.** That belongs to the wrapping skill.
- **Never skip the reviewer.** If the caller wants to bypass review, they must call `exec` directly, not this skill.
- **Never run more than 3 fixer passes.** Hard cap, owned by the reviewer.
- **Never modify the task list mid-flight.** If a task reveals a missing one, surface it under `Notes for caller` — the caller decides whether to extend scope.

## Failure modes

- **`exec` returns a blocker** → stop new launches, return a partial report with the blocker, do not proceed to review.
- **`exec` reports a commit that does not exist** → treat as blocker, do not proceed.
- **Pre-review verify fails** → stop, return a partial report, do not invoke reviewer.
- **Reviewer returns `hitl-blocked`** → return the report with `Verdict: blocked`. The caller decides what to do (surface to user, retry, etc.).
- **Reviewer fails before opening the PR** → return a blocker. Do not bypass with a manual push.

## Why this skill exists

Every issue-tracker flow (GitHub Issues, GitLab, Jira, or no tracker at all) has its own status names, sub-skill structure, and bookkeeping rituals. The implementation pipeline (`exec → reviewer → PR`) is the same in every one of them. Centralizing it here means:

- One place to evolve the pipeline (better swarm, faster loop, smarter labels) without touching every per-repo bundle.
- Per-repo skills stay tiny — they only describe their own status flow and call this skill for the code work.
- New repos / new flows install a tracker-bundle template (e.g. `github-issues-skill`), customize the status names, and they get the full pipeline for free.
