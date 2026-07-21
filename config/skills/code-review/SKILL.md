---
name: code-review
description: Use when reviewing code changes — pull requests, git diffs, uncommitted work, patch sets, or any "is this code OK?" question. Trigger phrases include "review this", "check my changes", "is this ready", "does this look right", "PR feedback", "code review", "look at my diff", "audit this code", "did I break anything". Also use when an agent is asked to verify whether a change solves a stated problem, follows codebase patterns, or is regression-safe. Do NOT use for greenfield code-writing requests — those need different guidance.
---

# Code Review

A methodology for reviewing code changes well. Usable by humans and agents.

This skill is grounded in Google's code-review guidance, the Conventional Comments specification, and Anthropic's context-engineering guidance for AI agents.

The skill exists because most code review failure modes are predictable. The reviewer rubber-stamps, the reviewer nitpicks, the reviewer hallucinates patterns that don't exist, the reviewer misses the actual bug while flagging the formatting. This skill makes those failures harder to commit.

---

## Core stance

A review is **a check that this change makes the codebase healthier, solves the stated problem, and does not introduce new risk** — performed by reading the actual code, not by guessing.

Two principles that override everything below if they conflict with it:

1. **Ground before you claim.** Never assert a fact about the code, the codebase, or the stated problem without reading the relevant source. Hallucinated review comments are worse than no comments — they erode trust and waste the author's time.
2. **Approve when code health improves, even if it isn't perfect.** Google's senior principle. "Perfect" is not the bar; "better than before, safe to merge" is. Block when something is genuinely wrong. Do not block on preference.

Everything else is procedure.

---

## Before writing any feedback: ground the review

Skipping these steps is the most common cause of bad reviews. Run them in order.

### Step 1 — Read the stated goal

What is the author trying to accomplish? Look for it in this order: the PR description, the commit message(s), the user's prompt, the linked ticket. If none of these exist, ask the author to state the goal in one sentence. Do not start the review until you have a goal — without it, you cannot judge whether the change is correct.

If the goal and the diff appear to mismatch (the diff does more, less, or different work than the goal claims), that is itself a finding — flag it before doing anything else.

### Step 2 — Read the entire diff

Look at every line of human-written code in the change. Don't scan — read. Some content (lockfiles, generated code, large data files, vendored deps) can be skimmed; production source cannot. If a section is too dense to understand on first read, that is a finding: ask the author to clarify or split the change.

### Step 3 — Read the surrounding code

Diff hunks lie. Four added lines in a 200-line function look fine in the diff and are awful in context. Read each changed file in full when the change touches non-trivial logic. For larger changes, at minimum read the full function and the file's top-level structure.

### Step 4 — Verify codebase claims before making them

If you are about to write *"there's a utility for this already"*, *"this doesn't match how X is done elsewhere"*, *"the existing pattern is Y"* — go find the utility, the other usage site, the existing pattern. Grep, glob, follow imports. If you cannot point to a specific file and line, you cannot make the claim. Replace with a question instead.

This rule is especially important for agent reviewers. The temptation to invent a plausible-sounding pattern from training data is high; the cost is that the author wastes time chasing a ghost.

### Step 5 — Check that the stated problem is actually solved

Before commenting on style, naming, or design, answer the core question: **does this change solve what it set out to solve?** Walk the relevant code path mentally with a realistic input. If the stated problem is "users see stale data after refresh," trace what happens on refresh in the changed code. If you cannot trace it, ask.

A change that is beautifully written but does not solve the stated problem is not a passable change.

---

## Review dimensions

These are the things to look for, adapted from Google's canonical list with two additions specific to modern review (problem-solution fit, regression surface). Run all of them. Not every dimension will produce findings on every review; that is expected.

### 1. Problem-solution fit

Does the change accomplish the stated goal? Is the scope right — does it do less than needed (incomplete), or more than needed (scope creep)? Are there obvious cases the change does not handle that the goal implies it should?

### 2. Design

Do the pieces of the change interact sensibly with the rest of the system? Is this the right layer for the change to live in? Should this code be in a library or a different module? Are abstractions at the right level of generality — neither leaky nor over-generic?

### 3. Functionality

Does the code do what the author intended, and is that good for the people who will use it (end users and future developers)? Walk through edge cases: empty inputs, max inputs, concurrent access, network failure, malformed data. For parallelism: deadlocks, races. For user-facing changes: would you want to use this?

### 4. Complexity

Is the change more complex than it needs to be? Check at every level — lines, functions, classes, modules. "Too complex" means a future reader will struggle. Be vigilant about **over-engineering**: generalizations for needs that don't exist yet, configuration for cases that haven't appeared, abstractions added "in case." Solve the problem you have now.

### 5. Pattern consistency and reuse

Does the change follow the conventions already established in this codebase? Are there existing utilities, helpers, or patterns that should have been reused instead of reimplemented? Are there other call sites for the same problem that look different from this change — and if so, which is right?

Two failure modes to watch for: (a) the change reimplements something that exists, and (b) the change is consistent with one part of the codebase but inconsistent with the part where new code of this kind should live. Both require reading other files to spot.

### 6. Naming and readability

Are names long enough to be clear, short enough to read fluently? Will a future reader understand what each piece is for? Is the code self-documenting where it can be, and commented where it can't?

### 7. Comments and documentation

Comments should mostly explain *why*, not *what*. If a comment is explaining what code does, usually the code should be made clearer instead. Exceptions: regex, complex algorithms, non-obvious tradeoffs, decisions whose context lives outside the file. Check that public APIs have docs and that existing docs are updated when behavior changes.

### 8. Testing

Are there tests? Do they actually exercise the change? Will they fail when the code breaks? Are they making meaningful assertions or just running the code? Are tests testing behavior or implementation details (the latter rots)? Don't accept complexity in tests because they're "just tests" — tests are code that must be maintained.

If the change is non-trivial and has no tests, that is a finding. The bar is "added tests in the same change," with rare exceptions for emergencies.

### 9. Error handling and failure modes

What happens when this code's preconditions are violated? When dependencies fail? When inputs are unexpected? Are errors propagated, logged, swallowed? Is the failure mode safe (degraded, rejected) or unsafe (corrupted state, partial writes, silent loss)?

### 10. Security and data handling

For any change that touches authentication, authorization, user input, file paths, queries, secrets, serialization, or external requests: look for injection vectors, missing authz checks, secret leakage, unsafe deserialization, path traversal, SSRF. If you are not qualified to assess this, say so and ensure someone qualified does.

### 11. Performance

Look for obvious red flags: N+1 queries, unbounded loops over user input, blocking I/O on hot paths, allocations in tight loops, missing indices for new query patterns. Do not speculate about micro-performance without measurement. Premature optimization is also a finding.

### 12. Regression surface

What else might this break? Are there callers of changed functions that the diff doesn't show? Are there implicit contracts (return types, side effects, ordering) that are silently changing? For any public-facing or widely-used code, this dimension deserves explicit thought.

### 13. Style

Style-guide violations are blocking only if the project has a style guide that requires them. Otherwise: nit, non-blocking. Style preferences are not findings. If existing code conflicts with the style guide, the style guide wins for new code. If no style guide applies, match the surrounding code.

### 14. Documentation updates

If the change modifies user-visible behavior, public APIs, build/test/deploy procedures, or anything covered by a README or doc, check that the docs are updated in the same change. Deprecated code's docs should be deleted.

---

## How to write feedback

Use the **Conventional Comments** format. It is a single-line label followed by a short subject and optional discussion. Format:

```
<label> [decorations]: <subject>

[discussion]
```

### Labels

Pick from this list. Use the most accurate label, not the most dramatic one.

| Label | Meaning |
|---|---|
| `praise` | Sincere acknowledgment of something done well. Use at least once per non-trivial review. Do not fake it. |
| `issue` | A specific problem with the code. State the problem; pair with a `suggestion` if you can. |
| `suggestion` | A proposed improvement. Make the suggestion concrete — what should change to what. |
| `question` | You suspect a problem but aren't sure. Asking is better than asserting incorrectly. |
| `nitpick` | Trivial preference. Always non-blocking. Use sparingly. |
| `todo` | Small, necessary change. |
| `thought` | An idea sparked by the review, not necessarily a request. Non-blocking. |
| `chore` | Process step the author needs to do (run X, file ticket Y, update Z). |
| `note` | Information the author should be aware of. Non-blocking. |

### Decorations

Append in parentheses after the label:
- `(blocking)` — must be addressed before merge
- `(non-blocking)` — can ship without fixing; useful for `suggestion` and `issue` when not critical
- `(if-minor)` — fix only if the change is small
- Topic tags like `(security)`, `(perf)`, `(test)`, `(a11y)`, `(ux)` when useful

### Writing the comment well

- **Be specific.** Quote or reference the offending line. "This is wrong" is not a comment; "this returns `null` when `users` is empty, but callers at `auth.ts:142` assume an array" is.
- **Be actionable.** The author should know what to do next. If you don't know what they should do, label it `question`.
- **Use "could" not "should"** for non-critical suggestions. Reserves "should" for actual requirements.
- **Explain the why** when it isn't obvious from the suggestion. Future readers learn from the reasoning, not the verdict.
- **One concern per comment.** Stacked comments are harder to discuss and resolve.

---

## Severity rubric

Every finding gets a severity. Authors should be able to glance at the review and know what blocks merge.

- **Blocking** — must be fixed before merge. Reserve for: real bugs, security issues, broken tests, missing tests for non-trivial logic, design problems that compound, regressions, and explicit style-guide requirements. Use `issue (blocking)` or `suggestion (blocking)`.
- **Non-blocking** — author should consider; can ship without addressing. Default for most suggestions and stylistic observations.
- **Nit** — trivial preference. Never block on these. Conventional Comments puts them under the `nitpick` label.
- **Praise** — non-blocking, explicitly positive.

Be honest about severity. Inflating "I'd prefer X" to blocking damages trust; downgrading a real bug to "non-blocking" is worse.

---

## Output structure for a complete review

Format the review in this order:

```
## Verdict
<one of: Approve / Approve with non-blocking comments / Request changes>

## Problem-solution check
<one or two sentences: does the change solve the stated goal? if no, what is missing>

## Summary
<2-4 sentences on what the change does and overall assessment>

## Findings

### Blocking
<conventional comments, grouped here; file:line for each>

### Non-blocking
<conventional comments, grouped here>

### Nits
<conventional comments, grouped here>

### Praise
<at least one sincere item if anything earned it>

## Open questions
<things you weren't able to verify and want the author to confirm>
```

Skip empty sections. Do not invent items to fill them.

For shorter changes, condensing to "Verdict / Findings / Praise" is fine. For very large changes, group findings by file or by theme inside each severity block.

---

## Anti-patterns specific to AI reviewers

These are the failure modes most common in LLM-driven code review. Each one is preventable.

- **Hallucinated patterns.** Claiming "the convention here is X" without having read other files. Cure: grep before claiming; replace assertions with questions when unverified.
- **Drive-by bug claims.** Asserting "this will fail when Y" without tracing the code path. Cure: write the trace in the discussion field, or downgrade to `question`.
- **Sycophancy.** Approving because the author seems confident, or because the code looks polished. Cure: run the dimensions checklist regardless of how the change is presented. Polished prose in a PR description does not vouch for the diff.
- **Nitpick deluge.** Twenty comments on naming and spacing, zero on the real bug. Cure: limit nits to the most egregious; rank findings by severity before writing them down.
- **Inventing findings to look thorough.** "There might be a performance issue here" with no specific concern. Cure: if you can't name the concern, don't write the comment. A short review is honest; a padded review is misleading.
- **Reviewing the diff in isolation.** Missing context because you read only the changed lines. Cure: read the surrounding code first (Step 3 above).
- **Ignoring the stated problem.** Producing a tidy review that never confirms whether the change works. Cure: the Problem-solution check section is mandatory; do not skip it.
- **Over-engineering recommendations.** Suggesting abstractions, configurations, and extensibility points the author did not ask for. Cure: recommend additions only when the current change creates a concrete near-term need; otherwise note as `thought`.
- **Confident severity inflation.** Marking preferences as blocking. Cure: reserve blocking for things that would harm the codebase if merged as-is.
- **Approving without verifying tests.** Tests exist ≠ tests are valid. Read at least one assertion; verify it would actually fail on the bug the test claims to catch.

---

## Pre-ship checklist for the review itself

Before delivering the review, run this list against it:

1. Did you read the entire diff, not just hunks?
2. Did you confirm the stated problem is solved (or flag that it isn't)?
3. Is every codebase-pattern claim backed by a specific file and line?
4. Is every bug claim backed by a code-path trace?
5. Is each finding tagged with a severity that reflects actual risk, not annoyance?
6. Is there at least one sincere `praise` if anything earned it?
7. Are all findings actionable — does the author know what to do?
8. Have you removed nits that don't matter, padding that doesn't inform, and speculation that isn't grounded?
9. Is the verdict consistent with the findings? (Blocking findings present → not Approve.)
10. Is the review the smallest it can be while still saying what needs to be said?

---

## When information is missing

If you cannot complete the review because critical context is missing, say so and stop. Examples:

- The diff references functions whose definitions you can't see → ask the author to widen the diff or grant read access.
- The stated goal is unclear → ask for a one-sentence statement of intent.
- The change touches a domain you cannot competently assess (security crypto, low-level concurrency, compliance) → state this and recommend a qualified reviewer.

A partial review with explicit gaps is more useful than a complete-looking review built on guesses.

---

## References

Primary sources:

- Google, [What to Look for in a Code Review](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
- Google, [The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)
- [Conventional Comments](https://conventionalcomments.org/)
- Anthropic, [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Software Engineering at Google, Chapter 9](https://abseil.io/resources/swe-book/html/ch09.html)
