---
name: agent-prompt-writing
description: Use whenever the task involves writing, drafting, revising, or reviewing a system prompt for an AI agent — autonomous or semi-autonomous LLM systems that use tools in a loop, including operator agents, research/sub-agents, tool-using assistants, MCP servers, multi-agent orchestrators, and coding agents. Trigger even when the user says "instructions", "system message", "agent persona", or "rules for the model", not just the word "prompt". Do NOT use for one-shot prompts (classification, single generation, single Q&A) — those need lighter prompt techniques, not the full agent skeleton.
---

# Agent Prompt Writing

A skill for writing system prompts that produce reliable, steerable agents.

This skill is grounded in published guidance from Anthropic (Building Effective Agents, Effective Context Engineering for AI Agents, Writing Effective Tools for AI Agents, Claude prompt engineering docs) and OpenAI (GPT-4.1 and GPT-5 prompting guides, A Practical Guide to Building Agents, Realtime prompting guide). Citations live in `references/sources.md`.

Apply this skill end-to-end every time. Do not skim. Bad agent prompts fail silently in production — the cost of skipping the checklist is real.

---

## Core principle: right altitude on a finite attention budget

Two facts shape everything that follows.

**First**, every token in the agent's context competes for a finite attention budget. As context grows, models lose precision (context rot). Good prompts use the smallest set of high-signal tokens that produces the desired behavior. Minimal is not the same as short — a 2000-token prompt can be minimal if every token earns its place.

**Second**, prompts must sit at the right altitude: specific enough to give the model strong heuristics, flexible enough not to encode brittle if-else logic. Two failure modes bracket the zone:
- **Too low** — hardcoded edge cases, prescriptive scripts, brittle rules. Breaks the moment reality deviates.
- **Too high** — vague platitudes ("be helpful," "use good judgment"). Gives the model nothing to act on.

The goal is the Goldilocks zone in between: principles plus enough concrete signal that the model can apply them.

---

## Before writing: capture intent

Do not draft until these are answered, either by reading the conversation or asking the user:

1. **What kind of agent?** One-shot, conversational, autonomous loop, sub-agent under an orchestrator, or part of a multi-agent system. The kind dictates the skeleton.
2. **What is success?** What does "done" look like, observable from outside? "Helpful" is not an answer; "responds with a JSON object containing X, Y, Z, after calling at most three tools" is.
3. **What tools does it have?** Names, purposes, expected order of use, what each returns. If tools don't exist yet, flag that — tool design and prompt design must be done together (see Tool Design section).
4. **What's the context shape?** What's static (identity, rules), what's dynamic per turn (user input, prior tool results, retrieved docs), what's persistent across turns (memory, state).
5. **Who is the caller?** Another agent, an end user, or a deterministic system. Output format depends on this.
6. **What failure modes have already been observed?** If iterating on an existing prompt, the prior failures are the most valuable input.

If any of these are unclear and the user can answer, ask. If the user can't answer, document the assumption inline in the prompt's design notes — never silently guess.

---

## The skeleton

Every agent prompt needs these sections, in roughly this order. Use markdown headers or XML tags to delineate them — pick one convention and hold it. Section names below are canonical; adapt only when there's a reason.

```
1. Identity & objective         — who the agent is, what "done" means
2. Scope & non-goals            — what's in bounds, what's out
3. Operating principles         — high-level heuristics
4. Tool catalogue & priority    — what's available, when to prefer what
5. Context & state              — what's provided each turn, what persists
6. Behavioral rules             — specific do's and don'ts with rationale
7. Output contract              — exact format and constraints
8. Failure & escalation         — what to do when stuck, what's off-limits
9. Examples                     — 2-5 canonical demonstrations
```

Sections 1, 4, 7, and 8 are non-negotiable. The rest are skipped only when the agent's scope makes them irrelevant (e.g., a tool-less classifier needs no tool catalogue).

Order matters less than presence. Place identity first so it primes everything downstream. Place examples last so they reinforce, not preempt.

---

## Section-by-section rules

### 1. Identity & objective

Open with one or two sentences that name the agent and state its purpose in concrete, observable terms. Avoid persona-flavor that doesn't constrain behavior.

Good:
> You are a research sub-agent. Your job is to answer a single focused research question using web search and return a JSON object containing `answer` and `sources`. You do not converse with end users.

Weak (too high):
> You are a helpful research assistant. Use your tools to help the user with their questions.

The objective should imply a success test. If you cannot describe a one-line acceptance check from the identity, the identity is too vague.

### 2. Scope & non-goals

State what the agent does NOT do. Modern instruction-following models (GPT-4.1+, Claude 4.x+) follow instructions literally — explicit non-goals prevent scope creep more reliably than hoping the model infers them. Examples of useful non-goals:

- "Do not answer general knowledge questions; redirect to the main agent."
- "Do not invent citations; if no source supports a claim, omit the claim."
- "Do not call write tools; you are read-only."

Three to seven non-goals is usually right. If the list balloons past ten, the scope itself is probably too broad and the agent should be split.

### 3. Operating principles

Five to ten high-level heuristics that shape behavior across cases not covered by explicit rules. These are the things you would say to a new hire to give them taste, not a checklist.

Examples:
- "Prefer one focused tool call over many speculative ones."
- "When sources conflict, surface the conflict; do not average or pick silently."
- "Quote sparingly; paraphrase by default."

Explain *why* where it isn't obvious — the rationale helps the model generalize. Anthropic's guidance: replace heavy-handed "MUSTs" with brief reasoning. OpenAI's guidance is similar: high-level goals plus enough context that the model can self-correct.

### 4. Tool catalogue & priority

This section earns its weight. Bad tool sections are the most common cause of agent failure.

For each tool, document in the prompt:
- **Name** — same as the registered tool name, exactly
- **One-line purpose** — what it does, no marketing
- **When to use** — the situation that calls for it
- **When NOT to use** — the situation it's mistaken for

Then give a priority rule: when multiple tools could apply, which wins. Decision-tree form ("Step 1: is X true? → tool A, stop. Step 2: ...") beats unordered priority lists, because it tells the model when to stop searching.

Detailed tool design rules live below in **Tool Design**. The prompt section is the catalogue; the tools themselves are a separate engineering surface.

### 5. Context & state

Document what's in the context window each turn and where it comes from. The model performs better when it knows whether information is fresh or stale, authoritative or speculative.

Typical fields to declare:
- Static: identity, rules, tool catalogue
- Per-turn dynamic: current date, user message, prior turn results
- Persistent: active IDs (course, module, ticket), user preferences, session memo
- Retrieved: documents fetched by tools earlier this turn

If the agent has implicit state ("the active course"), tell the model how to read it from context. Implicit references are otherwise resolved by guesswork.

### 6. Behavioral rules

The bulk of the prompt. Specific, actionable rules. Group by theme. Each rule short. Each rule rationale'd where the rationale isn't obvious.

Two patterns worth using:

**Boundary cases by name.** Instead of abstract rules, enumerate the cases the model gets wrong. Anthropic's published prompts (Claude.ai, Claude Code) lean heavily on this. Example for a research agent:
- *"What's the latest on X?"* → search.
- *"What is X?"* (well-known concept) → answer directly.
- *"What is X?"* (unknown to model) → search before answering. Unknown ≠ obscure; an unrecognized proper noun is almost certainly a name that postdates training.

**Forbidden-phrase lists** for tone. If you want a concise agent, list the verbosity tells to suppress: "Great question," "I'd be happy to," "Certainly!", "Let me explain". Concrete strings are more enforceable than the adjective "concise".

### 7. Output contract

Be precise. The model will follow whatever shape you specify, so specify exactly what downstream code or humans need.

Required elements:
- **Format** — prose, JSON, structured fields, code only, etc.
- **Length** — token, sentence, or word ceiling and floor
- **Required fields** — for structured output, the schema (or a reference to it)
- **Forbidden elements** — markdown if the consumer is plain-text, emojis, preambles, trailing commentary

For structured output, prefer the API's native structured-output / tool-call mechanism over asking for JSON in prose. JSON-in-prose is fragile; tool calls and JSON schema modes are not. (Both Anthropic and OpenAI document this.)

For prose output, give a concrete length anchor: "one sentence, max 35 words" beats "concise". Length anchors are the fastest way to align verbosity.

### 8. Failure & escalation

Document what the agent does when:
- A required tool errors or times out
- A tool returns empty or contradicts another tool
- The user request is ambiguous
- The user request is out of scope
- The model is uncertain (confidence is low)
- A safety/policy limit is hit

For each, specify the fallback action: retry once, hand off, ask one clarifying question, refuse with a specific message. "Use good judgment" is not a fallback — it's a non-answer.

For safety-relevant refusals, name the principle, not the detection mechanism. Telling the model "I refused because you said keyword X" teaches the next user to avoid keyword X.

### 9. Examples

Few-shot examples are the single highest-leverage element after the identity. Anthropic's published guidance: "examples are the 'pictures' worth a thousand words." But quality matters more than quantity.

Rules:
- **Two to five examples**, not ten or twenty.
- **Canonical, not edge cases.** Each example should illustrate a principle that generalizes. Stuffing every edge case as a case study is the failure mode Anthropic explicitly warns against.
- **Diverse.** If all five examples are the same shape, the model overfits.
- **Show inputs and outputs.** For agentic flows, show the tool calls in between.
- **Include at least one counter-example** with a labeled rationale ("incorrect because...") for any rule the model is likely to break.

---

## Tool design rules

Tool design and prompt design are inseparable. Bad tools make the prompt section impossible to write cleanly. If the user has not yet written the tools, advise on tool shape before drafting the catalogue.

**Choose tools that fit how agents work, not how APIs are organized.** Wrapping every API endpoint in a tool is the most common anti-pattern. Agents do better with a few high-level tools that consolidate multi-step work (`schedule_event` over `list_users` + `list_calendars` + `create_event`).

**Namespace by service or resource.** `asana_search`, `jira_search` is clearer than two tools both called `search`. Empirically affects tool selection accuracy.

**Return high-signal data, not raw API payloads.** Drop UUIDs, MIME types, internal flags. Keep names, types, dates, content. If the agent needs IDs for downstream calls, expose a `response_format: "concise" | "detailed"` enum.

**Token-budget every tool.** Set a default response cap (Anthropic uses 25k tokens for Claude Code tools). Implement pagination, range selection, and filtering. Truncate with helpful messages, not silent cutoffs.

**Error messages are prompts.** A bad error: `400 Bad Request`. A good error: `Invalid date format: "tomorrow". Use ISO 8601 (e.g., 2026-06-19). Use the get_current_date tool if you need today's date.` The model reads the error and recovers.

**Tool descriptions are prompts too.** Treat each tool's description as a mini system prompt. Write it the way you would explain to a new hire: what it does, when to use it, when not to use it, what surprising behaviors exist. Cross-reference with the prompt's tool catalogue — they must not contradict.

---

## Context engineering for long-horizon agents

If the agent operates over many turns or long tool chains, the context will exceed the window. Three techniques, used together or separately:

**Compaction.** When approaching the window limit, summarize the conversation into a high-fidelity memo and restart the window. Keep architectural decisions, unresolved questions, active state. Drop redundant tool outputs. Anthropic's Claude Code does this; their guidance: maximize recall first, then prune.

**Structured note-taking.** Have the agent write notes to a file or memory store outside the context, then re-read on demand. Works for to-do lists, progress logs, learned facts. The agent's own notes are often higher-signal than its conversation history.

**Sub-agent isolation.** Spawn focused sub-agents with clean, narrow contexts for deep work; have them return only condensed summaries (1-2k tokens) to the orchestrator. Anthropic's multi-agent research system uses this. The detailed exploration stays isolated; the orchestrator stays clean.

For each technique, the prompt of the participating agent must explicitly support it. The sub-agent must know it returns condensed output. The note-taking agent must know what's worth writing down. None of this is automatic.

---

## Pre-ship checklist

Run this list against any prompt before it ships. If any answer is "no", fix before shipping.

1. Can a stranger read the identity section and state, in one sentence, what success looks like?
2. Are non-goals enumerated explicitly?
3. For every tool: is its purpose, when-to-use, and when-not-to-use stated?
4. Is there an ordered decision rule for choosing between tools that could overlap?
5. Is the output format specified concretely (schema, length cap, forbidden elements)?
6. Are there 2-5 canonical examples covering the typical shapes the agent must handle?
7. Is at least one counter-example included for the rules most likely to be violated?
8. Are failure modes covered (tool error, empty result, ambiguity, refusal)?
9. Have brittle if-else cases been replaced with principles + rationale where possible?
10. Have vague platitudes ("be helpful," "use good judgment") been replaced with concrete signals?
11. Is the total prompt the smallest version that still carries every required signal?
12. Does the prompt assume any context that isn't actually injected at runtime?

---

## Anti-patterns to avoid

These are the failure modes that show up most often in agent prompts. Check your draft against this list.

- **Stuffing every edge case as a rule.** Curate canonical examples instead.
- **Wrapping every API as a tool.** Build fewer, higher-level tools.
- **Cute personas that don't constrain behavior.** "You are a wise wizard" is decoration, not direction.
- **Conflicting instructions across sections.** Most common contradictions: tone (formal vs friendly), verbosity (brief vs thorough), refusal posture (helpful vs cautious). Resolve before shipping.
- **Implicit shared context.** Telling the model "use the standard format" when the standard isn't defined in-prompt. Either define it or remove the reference.
- **Examples that contradict the rules.** Models follow examples over rules when they conflict.
- **Length without anchors.** "Be concise" without a sentence or word cap.
- **Refusal text that teaches bypass.** "I can't help because you mentioned X" teaches the next user to avoid X.
- **Asking for JSON in prose** when structured-output / tool-call mode is available.
- **Markdown formatting instructions that don't survive the rendering surface.** If the consumer is a TTY or plain-text channel, asking for tables and headers is noise.
- **Hardcoded dates, models, or version strings** that will rot. Inject them dynamically per turn.

---

## Self-critique before shipping

After drafting, run the prompt past a critique pass. OpenAI publishes a meta-prompt for this; the technique works regardless of which model you're targeting. Ask the model (or yourself):

> Examine the prompt below. Identify:
> 1. Ambiguities — phrases interpretable more than one way.
> 2. Contradictions — rules that conflict.
> 3. Missing definitions — terms used but not defined.
> 4. Unenforced rules — rules with no observable signal (e.g., "be concise" without a length cap).
> 5. Brittle hardcoding — if-else logic that will break on the next edge case.
> 6. Vague platitudes — instructions that give the model no actionable signal.
>
> For each, quote the offending text and propose a concrete fix.

Apply the proposed fixes. Re-run the critique. Stop when the critique returns nothing material.

---

## Iteration is the work

A first-draft prompt is never the final prompt. Anthropic's published guidance is explicit: start with a minimal prompt, test on real traces, add only what's needed to fix observed failures. OpenAI's guidance: start with the smallest prompt that passes your evals, add blocks only when they fix a measured failure mode.

The rule of thumb: **every line in the final prompt should be traceable to a failure mode it prevents, an example it generalizes from, or a hard requirement it encodes.** Lines that don't earn their place by one of these three criteria are noise.

If the user has not yet set up evals, recommend doing so before further iteration. An agent prompt without evals is a guess.

---

## When the user asks for a prompt

If a user (often another agent) is asking you to write or revise an agent prompt:

1. Run the **Before writing: capture intent** checklist. Ask only what you cannot infer.
2. Draft the prompt using the **skeleton** and **section-by-section rules**.
3. Apply the **anti-patterns** filter as you write.
4. Run the **pre-ship checklist** against the draft.
5. Run the **self-critique** pass.
6. Deliver the prompt with a short note listing assumptions made and what to test first.

If you cannot complete steps 1-6 in one shot — for instance, because the user hasn't decided on tools yet — stop and surface the blocker. Do not invent the missing pieces.

---

## References

See `references/sources.md` for full citations. Primary sources:

- Anthropic, *Building Effective Agents* (Dec 2024)
- Anthropic, *Effective Context Engineering for AI Agents* (Sep 2025)
- Anthropic, *Writing Effective Tools for AI Agents* (Sep 2025)
- Anthropic, Claude prompt engineering docs (`docs.claude.com/en/docs/build-with-claude/prompt-engineering`)
- OpenAI, *A Practical Guide to Building Agents*
- OpenAI, *GPT-4.1 Prompting Guide* and *GPT-5 Prompting Guide*
- OpenAI, *Realtime Prompting Guide* (skeleton structure)
