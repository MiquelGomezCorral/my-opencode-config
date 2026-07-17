---
name: grill-me
description: Pressure-test a plan, design, architecture, implementation approach, or product decision through a direct decision-tree interview. Use when the user asks to be grilled, stress-tested, challenged, interviewed, or pressure-tested before execution.
---

# Grill Me

## Source Note

Adapted for this repository from `grp06/useful-codex-skills/grill-me`, licensed under the MIT License, Copyright (c) 2026 George Pickett.

## When to use

- The user explicitly says "grill me" or asks to pressure-test, stress-test, challenge, or interview them about a plan.
- The user has a design, architecture, product decision, implementation approach, migration plan, PRD, RFC, or draft `/goal` that needs sharper assumptions and acceptance criteria before execution.
- The task is still a decision-making session. If the user asks for implementation, switch back to the relevant execution skill or normal repo workflow.

## Contract

Interrogate the plan until the important decisions, dependencies, assumptions, and failure modes are resolved or explicitly accepted as open risk.

Do not merely list questions. Drive toward shared understanding. For every question, include your recommended answer. If the answer can be discovered from repository files, logs, docs, config, tests, prior plans, or other available artifacts, investigate first and present the evidence instead of asking the user.

Do not implement during a `grill-me` session unless the user explicitly asks to switch from interrogation to execution.

## Skill Composition

- When grilling a repository-specific plan and `AGENTS.md` or `.agents/` exists, load and apply `agents-memory`; read only relevant architecture, decisions, conventions, workflow, or known-error context. Do not bootstrap or update memory unless requested.

## Workflow

1. Identify the plan under review:
- If the user provided a plan, summarize the current understanding in 3 to 6 bullets.
- If the plan lives in files, issues, docs, screenshots, or code, inspect the relevant artifacts before beginning the interview.
- If no concrete plan is available, ask for the smallest artifact that would make the grilling useful and recommend what they should provide.

2. Build a decision tree:
- Start with goal, users, success criteria, constraints, non-goals, and expected evidence.
- Then branch into architecture, data flow, ownership boundaries, state transitions, operational model, risks, validation, rollout, rollback, and maintenance.
- Keep dependencies explicit. Do not ask a downstream implementation question before the upstream product or architecture choice it depends on is settled.

3. Resolve one branch at a time:
- Ask the next highest-leverage unresolved question.
- Explain why it matters, what decision it unlocks, and your recommended answer.
- After the user answers, restate the resolved decision and move to the next dependent branch.
- Ask up to three small questions together only when they belong to the same branch. Otherwise prefer one sharp question at a time.

4. Explore instead of asking when possible:
- Use repo discovery commands such as `rg`, `rg --files`, manifests, docs, tests, git history, and nearby source.
- Read relevant files end-to-end when they own the behavior under discussion.
- Distinguish evidence from inference. If evidence is missing, say what you checked and ask only the remaining judgment question.
- For external SDK or framework behavior in this repo, follow `btca-first` when applicable before relying on memory.

5. Maintain a shared-understanding ledger:
- Confirmed decisions.
- Open decisions.
- Assumptions.
- Risks and failure modes.
- Validation or proof needed.
- Follow-up artifacts to create or update.

## Question Format

Use this compact format unless the user asks for a deeper written audit:

```markdown
Current understanding:
- ...

Question:
...

Why it matters:
...

Recommended answer:
...

What this unlocks:
...
```

When the user answers, respond with:

```markdown
Resolved:
- ...

Next question:
...
```

## Interview Standards

- Be direct about ambiguity, hidden coupling, hand-wavy success criteria, unclear ownership, and untested assumptions.
- Push for concrete examples, exact users, exact inputs and outputs, explicit state transitions, measurable acceptance criteria, and rollback paths.
- Prefer simple designs with fewer concepts, fewer modes, clear ownership, and verifiable behavior.
- Challenge options that push complexity onto callers, operators, future maintainers, support teams, or users.
- Separate facts discovered from the codebase from product or strategy calls only the user can make.
- Do not accept vague answers as resolved decisions. Restate the gap and ask the narrowest follow-up.
- Keep the tone rigorous and pragmatic, not performative or adversarial.

## Stop Conditions

Stop grilling only when one of these is true:
- The user asks to stop, pause, switch modes, or proceed to implementation.
- Every major branch has a resolved decision or an explicitly accepted open risk.
- The missing information requires user judgment, credentials, external access, or product authority that cannot be inferred.
- Continuing would repeat the same unresolved blocker without new evidence.

End with a concise decision ledger and the next best action.
