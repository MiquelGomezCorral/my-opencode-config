# Sources

Every principle in this skill is traceable to one or more of these published sources. Cross-referenced where principles converge; flagged where sources diverge.

## Anthropic

- **Building Effective Agents** — Erik Schluntz, Barry Zhang, Dec 2024.
  https://www.anthropic.com/research/building-effective-agents
  - Workflows vs. agents distinction
  - "Start simple, add complexity only when warranted"
  - Patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer
  - Three principles: maintain simplicity; prioritize transparency; design the agent-computer interface carefully

- **Effective Context Engineering for AI Agents** — Anthropic Applied AI team, Sep 2025.
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
  - Context as finite resource; "context rot"
  - Right-altitude system prompts (Goldilocks zone between brittle if-else and vague platitudes)
  - Curated canonical examples over edge-case laundry lists
  - Just-in-time context retrieval
  - Long-horizon techniques: compaction, structured note-taking, sub-agent architectures

- **Writing Effective Tools for AI Agents — Using AI Agents** — Ken Aizawa, Sep 2025.
  https://www.anthropic.com/engineering/writing-tools-for-agents
  - Choose few high-impact tools over wrapping every endpoint
  - Namespacing (e.g., `asana_search`, `jira_search`)
  - High-signal returns; drop UUIDs and internal flags
  - Response format enum (`concise` / `detailed`)
  - Token efficiency: pagination, truncation, range selection
  - Error messages as prompts
  - Tool descriptions as mini system prompts

- **Claude prompt engineering docs**.
  https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview
  - XML / markdown sectioning
  - Few-shot examples
  - Extended thinking guidance
  - Prefill technique
  - Avoid over-engineering; trust internal guarantees

- **Multi-agent research system post-mortem**.
  https://www.anthropic.com/engineering/multi-agent-research-system
  - Sub-agent isolation for parallel exploration
  - Condensed summaries back to orchestrator (1-2k tokens typical)

## OpenAI

- **A Practical Guide to Building Agents**.
  https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf
  - Clear instructions reduce ambiguity
  - Use existing documents as source for routines
  - Break dense resources into smaller steps
  - Define clear actions for every step
  - Guardrails: input + output + escalation
  - Structured outputs whenever output feeds downstream code

- **GPT-4.1 Prompting Guide**.
  https://cookbook.openai.com/examples/gpt4-1_prompting_guide
  - Instruction following is more literal; specify explicitly what to do and not do
  - Three agentic reminders to include in all agent prompts:
    1. Persistence (keep going until query resolved)
    2. Tool calling (use tools, don't fabricate)
    3. Planning (explicit plan-then-execute)
  - Use API `tools` field, not manual schema injection

- **GPT-5 Prompting Guide**.
  https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide
  - Reasoning effort calibration
  - Agentic eagerness control
  - Cursor's tool-calling reliability patterns

- **Prompt Guidance** (GPT-5.4/5.5).
  https://developers.openai.com/api/docs/guides/prompt-guidance
  - "Start with smallest prompt that passes evals; add blocks only when they fix a measured failure mode"
  - Output contracts
  - Citation gating
  - Verification loops as cheaper than higher reasoning settings

- **Realtime Prompting Guide**.
  https://developers.openai.com/cookbook/examples/realtime_prompting_guide
  - Section skeleton: Role & Objective, Personality & Tone, Context, Tools, Instructions, Conversation Flow, Safety & Escalation
  - Prompt-critique meta-prompt (used in this skill's self-critique section)

- **Prompt Generation docs**.
  https://platform.openai.com/docs/guides/prompt-generation
  - Meta-prompt structure; preserve user content; constants in prompt
  - Output format specification

## Convergence points (both Anthropic and OpenAI agree)

- Start minimal; add only what observed failures require.
- Define success criteria observably.
- Structured outputs > JSON-in-prose when downstream code consumes the output.
- Canonical examples beat exhaustive rule lists.
- Tools must be designed for agents, not for human developers.
- Evals are non-negotiable; prompts without evals are guesses.
- Tool descriptions and prompts must not contradict.
- Specify what NOT to do explicitly for modern instruction-following models.

## Divergence / nuance

- **Reasoning models vs. general models.** OpenAI explicitly distinguishes: reasoning models prefer high-level goals; general models prefer precise instructions. Anthropic's extended-thinking guidance is similar but less prescriptive about prompt style differences.
- **Verbosity defaults.** Claude's recent models default to more concise output; GPT-5.x may require explicit verbosity caps. Always anchor with concrete length limits regardless of model.
- **Compaction strategies.** Anthropic publishes specific Claude Code compaction patterns; OpenAI describes similar long-horizon techniques but less prescriptively. Either company's approach generalizes.