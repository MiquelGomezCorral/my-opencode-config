---
name: goalcraft
description: Turn a rough task brief, vague ambition, or draft Codex /goal into a compact, evidence-driven goal for long-running autonomous work. Use when the user asks to write, improve, sharpen, stress-test, or activate a Codex goal, thread goal, durable goal, or /goal prompt.
---

# Goalcraft

## When to use

- The user wants a Codex `/goal` written or improved.
- The user has a broad task and wants an agent to keep working until there is real completion evidence.
- The user asks to stress-test a goal for scope, verification, stop conditions, or premature "done" risk.

## Contract

Convert messy intent into a ready-to-paste `/goal` objective: a compact, thread-scoped completion contract that is tight on scope, explicit about evidence, and hard to complete prematurely.

A strong goal defines a closed loop: choose the next useful action, run it, score progress against explicit evidence, record the result when useful, then continue or stop based on the contract.

Default to drafting only. Do not call `create_goal`, set a thread goal, or otherwise activate the goal unless the user explicitly asks to start or set it.

## Workflow

1. Decide whether a Goal is the right tool:
- Use a Goal for durable work with an evidence-based finish line and a path that may require several turns of investigation, implementation, verification, or iteration.
- Do not recommend a Goal for a one-line edit, simple explanation, short code review, or request where the user wants one answer and then a stop.
- If the finish line is vague, recommend a goal-sharpening pass before activation instead of drafting a broad objective like "make this better."

2. Identify the objective:
- Preserve the user's actual intent.
- If a repo, issue, branch, or files are mentioned, inspect them before finalizing.
- Ask only when a missing decision would materially change scope or risk. Otherwise, state assumptions.

3. Shape the goal around these six fields:
- Outcome: what must be true when the goal is complete. Make this observable, not merely an activity.
- Context: the starting point Codex must inspect or preserve, such as repo, branch, files, issues, docs, logs, screenshots, current failure, known state, or source material.
- Boundaries: what is in scope and out of scope, including files, directories, systems, tools, data, repositories, resources, deliverables, and approval-controlled actions.
- Constraints: behavior, public APIs, data model, security boundaries, i18n rules, package-manager rules, style conventions, user requirements, and other no-regression requirements.
- Verify: commands, tests, benchmarks, reports, screenshots, traces, logs, generated artifacts, source evidence, or explicit user confirmation required before claiming success.
- Stop conditions: done criteria, blocked criteria, and approval boundaries. Include when to continue iterating, when to declare done, and when to stop and ask.

4. Add supporting details only when they improve the contract:
- Deliverables: concrete artifacts such as code paths, tests, PRs, reports, screenshots, logs, or documentation.
- Approval boundaries: destructive actions, credentials, deploys, commits, messages, purchases, schema changes, payment-sensitive changes, security-sensitive changes, or other user-controlled decisions.
- Checkpoint rhythm: how often to test, review, summarize progress, or pause.
- Completion signal: the observable result that proves completion.
- Realistic environment: production-like preview, matching flags/config, representative data, authenticated browser session, real device, or other surface needed for evidence to mean what the goal says it means.
- Progress surface: attempt ledger, current-state summary, draft PR, status artifact, update channel, or side-chat-readable status when the work may run for hours.

5. Design the feedback loop before drafting:
- Identify the score: metric, checklist, test result, scorecard, artifact count, benchmark, manual-review packet, or other evidence that lets Codex decide whether progress improved, stalled, or completed.
- For measurable goals, prefer a baseline, target, measurement method, and anti-gaming guardrail. For example, test pass-rate goals must not be achieved by deleting meaningful coverage.
- Prefer a fast iteration evaluator plus a slower final gate. For example: focused test, smoke test, lint/typecheck, subsampled eval, or checklist during work; full suite, deploy check, visual review, or final report before done.
- For research goals, require a final artifact that separates confirmed findings, approximate reconstructions, support-only evidence, blocked claims, and remaining uncertainty.
- For visual goals, completion should usually be anchored to specs, design-system rules, interactions, accessibility, and visual-diff evidence. Do not let a reference image become a shortcut unless image matching is explicitly required.
- For long-running implementation goals, require cleanup/review before completion: inspect failed attempts, remove abandoned scaffolding, run relevant checks, and summarize final evidence plus remaining risks.

6. Keep the goal operational:
- Make every requirement auditable against files, commands, UI state, PR state, logs, or explicit user confirmation.
- Use exact commands only when they are known from the repo or the user.
- Avoid implementation details unless they are requirements.
- Keep the objective under 3,400 characters. The hard Codex objective limit is 4,000 characters, so treat 3,400 as the normal target.
- Keep token budgets separate from the `/goal` text unless the target surface has a separate budget field.
- Do not embed slash-command flags in the goal text. For example, `/goal --tokens 50K ...` is objective text, not parsed goal configuration.
- Put rationale, long examples, candidate lists, detailed scorecards, and nonessential context outside the `/goal` payload or in a referenced file.

7. Choose output mode:
- If drafting: return assumptions, then one ready-to-paste `/goal` block.
- If reviewing: list weaknesses first, then provide a revised `/goal`.
- If activating: validate the final objective, then call the available goal tool only after confirming there is no conflicting active goal.

## Output Shape

Use this compact shape by default:

```text
Assumptions:
- ...

Ready-to-paste goal:
/goal Outcome: ...
Context: ...
Boundaries: ...
Constraints: ...
Verify: ...
Stop conditions: ...
```

After the block, report the validated objective length:

```text
Objective length: 2,914 characters
```

## Validation

Before returning a final `/goal`, run this skill's validator:

```bash
python3 .agents/skills/goalcraft/scripts/validate_goal.py --strict-target --target-chars 3400 <file-containing-goal>
```

The validator strips a leading `/goal` and counts only the objective text. If the objective exceeds the target, compress and re-run validation.

If the skill is copied outside this repository, resolve the script path relative to this `SKILL.md`, not relative to the user's working directory.

## Quality Bar

- The goal should survive compaction or handoff to another agent.
- The next loop should be obvious: choose an action, run it, score it, record the result when useful, and continue or stop.
- "Done" must require evidence, not intent, elapsed time, budget exhaustion, proxy signals, or passing unrelated checks.
- Scope boundaries must be explicit enough to prevent accidental refactors.
- Stop conditions must protect destructive, security-sensitive, payment-sensitive, schema-changing, or externally visible actions.
- The goal should make fake progress hard by preserving meaningful tests, realistic inputs, real interaction paths, and other counter-metrics that protect the user's actual intent.
- The goal should avoid over-prescribing implementation details unless those details are part of the actual requirement.
