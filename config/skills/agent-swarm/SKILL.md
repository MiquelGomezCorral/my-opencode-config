---
name: agent-swarm
description: General multi-agent orchestration for OpenCode. Use proactively whenever a non-trivial task can benefit from independent parallel research, investigation, review, testing, debugging, comparison, verification, or disjoint implementation. Also trigger when the user asks for a swarm, multiple agents, parallel agents, subagents, independent opinions, or broader coverage. Keep trivial, tightly coupled, or single-writer work in the main thread.
---

# Agent Swarm

Coordinate focused subagents while the parent remains the manager and owns the final result. A swarm is useful for parallel attention, not as ceremony around work one agent can do cleanly.

## Swarm gate

Launch a swarm when all are true:

- The task has at least two independent scopes, perspectives, or attempts.
- Workers can return bounded results without sharing an evolving context.
- Better coverage or lower wall-clock time justifies extra model usage.

Stay in the main thread when the task is trivial, sequential, tightly coupled, or requires several agents to edit the same files. Broad automatic triggering means considering a swarm proactively, not spawning one reflexively.

## Parent contract

The parent agent is the orchestrator. It must:

1. Define success before delegation.
2. Split work without gaps or accidental overlap.
3. Select agents from the currently available roster by description, permissions, and specialty.
4. Give each worker enough context because subagents do not inherit the parent conversation.
5. Collect, verify, deduplicate, and synthesize results.
6. Return one coherent answer rather than a transcript collage.

Workers do not coordinate the swarm, redefine scope, or decide the final answer. Do not create nested swarms unless the user explicitly requests a large hierarchical run and the available agent permits delegation.

## Choose a pattern

| Pattern | Use when | Shape |
|---|---|---|
| Sectioning | Work divides into independent areas | Different scope per worker |
| Voting | Independent attempts increase confidence | Same question, deliberately different lens |
| Specialist review | A result needs complementary scrutiny | Different review dimension per worker |
| Dependency waves | Some tasks depend on earlier results | Parallelize only currently unblocked tasks |

Use sectioning by default. Use voting only when diversity is intentional; duplicated prompts otherwise waste tokens. Use dependency waves instead of pretending dependent work is parallel.

## Size the swarm

- Start with 2 workers.
- Use 3-4 for broad or high-risk tasks with clearly distinct roles.
- Do not exceed 5 without explicit user direction or unusually broad evidence needs.
- Prefer one narrow follow-up worker over relaunching the whole swarm.

## Build the roster

Inspect the available subagent descriptions before choosing. Do not invent agent names or assume tools they do not have.

- Use read-only agents for exploration, research, review, and verification whenever possible.
- Use specialist reviewers only for dimensions relevant to the task.
- Use a write-capable agent only when the user requested implementation.
- Let each agent use its configured model unless the user requests specific models or providers. Pass `model` for a preferred first attempt; pass `models` for the exact ordered chain. Provider restrictions such as "OpenAI only" must become an exact `models` chain, never just worker-prompt text.
- Respect agent permissions and any instruction that restricts manual-only agents.

For code review, choose from the available reviewer agents by their current descriptions and apply the specialist review playbook below.

## Write isolation

Concurrent writers are allowed only when their ownership is unambiguous:

- Assign disjoint files or modules, or use isolated git worktrees.
- Assign one owner per file for the duration of a wave.
- State adjacent worker scopes so each writer knows what not to touch.
- Never let workers commit, push, open pull requests, or modify shared infrastructure unless the user explicitly requested it.
- Integrate and verify combined work in the parent after every wave.

If safe isolation is unavailable, serialize the writers or keep implementation in the parent.

## Worker task packet

Every task prompt must contain this information, omitting only fields that truly do not apply:

```text
Goal: One observable outcome.
Scope: Exact files, subsystem, question, or perspective owned by this worker.
Exclusions: Work assigned elsewhere or explicitly out of bounds.
Context: Relevant decisions, constraints, paths, errors, and dependency results.
Allowed actions: Read-only, commands permitted, or isolated edits permitted.
Models: Configured default, preferred first model, or exact ordered chain.
Deliverable: Exact result shape and desired brevity.
Evidence: File:line references, URLs, command output, tests, or reproduction steps required.
Stop: Completion condition and blockers that require returning early.
```

Do not paste large files or full transcripts when workers can read the source directly. Pass conclusions and locations, not context noise.

## Launch protocol

1. Map dependencies before launching.
2. Put independent `task` calls in one `multi_tool_use.parallel` call.
3. Prefer foreground task calls inside the parallel wrapper when the next step needs every result.
4. Use `background: true` only when useful parent work can continue; save returned task IDs and rely on completion notifications.
5. Do not poll with tools that are not available, and do not block the parent with sleep loops.
6. Launch the next dependency wave only after required prior results are verified.

Send one short progress update before a substantial swarm: what roles are launching and why parallelism helps. Do not narrate every worker action.

## Collection and failure handling

- Continue with successful workers when one non-critical worker fails.
- Retry a transient failure once, preferably with the same task ID when resumption is supported.
- Do not retry structural failures unchanged. Narrow the task, correct the contract, or report the blocker.
- Replace a failed critical worker with one narrower worker when its result is required.
- Preserve partial evidence and identify missing coverage.
- Stop when success criteria are met, no new evidence is appearing, or the configured attempt limit is reached.

## Synthesis protocol

The parent must inspect worker results before presenting them:

1. Merge duplicate findings.
2. Rank claims by evidence, impact, and confidence rather than agent order.
3. Verify critical or surprising claims against source files, official sources, or runnable checks.
4. Resolve factual disagreements with evidence.
5. Preserve unresolved design disagreements as explicit tradeoffs.
6. Identify coverage gaps caused by failed or incomplete workers.
7. Produce the requested artifact or answer, not merely a swarm report.

## Common playbooks

### Review

Assign complementary dimensions such as correctness, architecture, and integration. Require actionable findings with file:line evidence. Deduplicate before reporting and list findings by severity.

### Testing and verification

Split by test surface, environment, or hypothesis. Avoid running destructive or resource-heavy suites concurrently in one workspace. The parent reproduces important failures and reports exact commands.

### Research and investigation

Split by source family, subsystem, competing hypothesis, or time period. Require primary sources or local evidence. The parent cross-checks consequential claims and cites the final sources.

### Debugging

Assign independent hypotheses, reproduction, code-path tracing, and history analysis. Do not let every worker attempt the same broad diagnosis. The parent chooses the explanation best supported by evidence.

### Comparison and design

Give workers distinct options or evaluation dimensions, then compare them against shared criteria. Preserve real tradeoffs instead of forcing false consensus.

### Implementation

Create dependency-aware waves. Give writers isolated ownership, require task-level verification, inspect each result, then run combined verification in the parent before launching dependent work.

## User-facing result

Return the requested answer first. Add a compact swarm note only when useful:

```text
Agents: <roles completed; failures if any>
Result: <synthesized outcome>
Verification: <checks or evidence>
Disagreements/gaps: <only if material>
```

The user should expect child sessions, faster completion for genuinely independent work, higher token usage than a single agent, and a useful partial result when non-critical workers fail.

## Source basis

Primary guidance:

- Anthropic, Building effective agents: https://www.anthropic.com/research/building-effective-agents
- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- OpenAI Agents SDK, Agent orchestration: https://openai.github.io/openai-agents-python/multi_agent/
- OpenCode, Agents: https://opencode.ai/docs/agents/
- Claude Agent SDK, Subagents: https://code.claude.com/docs/en/agent-sdk/subagents

Existing skill implementations reviewed for practical patterns, not treated as authoritative APIs:

- https://github.com/am-will/swarms
- https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea
