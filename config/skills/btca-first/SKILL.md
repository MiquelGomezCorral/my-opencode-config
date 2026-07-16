---
name: btca-first
description: Source-first SDK and framework research with btca. Use when a task depends on current behavior or recommended usage of AI SDK, Cloudflare, Effect, PostHog, or adjacent integrations, and you want the agent to consult btca before relying on memory or generic web search.
---

# btca-first

Use this skill when the task depends on current external-library behavior, recommended integration patterns, or SDK capability checks. In this repo, `btca` is the default source-first workflow for `ai`, `cloudflare`, `cloudflare-ai-chat`, `effect-smol`, `posthog`, `autoevals`, `braintrust-sdk-javascript`, and related cross-resource questions.

## When to use

- The task asks how to use an SDK or platform feature
- The task depends on current docs or recommended patterns
- The task spans more than one vendor boundary, such as AI SDK plus Cloudflare Workers
- You need evidence from source repositories before implementing or reviewing code

## Resource Map

| Topic | btca resources |
|------|----------------|
| AI SDK, tools, streaming, structured outputs | `ai` |
| Workers, R2, Queues, Workflows, Durable Objects | `cloudflare` |
| Cloudflare AI Chat package source | `cloudflare-ai-chat` |
| Effect patterns and examples | `effect-smol` |
| Analytics, telemetry, feature flags, tracing | `posthog` |
| Braintrust evaluation scorers and model-graded evals | `autoevals` |
| Braintrust TypeScript SDKs, eval runners, and tracing integrations | `braintrust-sdk-javascript` |
| Cloudflare agent architecture examples | `agents-starter` |
| URL query state in React and Next.js | `nuqs` |

Use multiple resources when the question crosses boundaries.

## CLI Baseline

Use the live CLI, not memory, for the command shape:

```bash
btca status
btca ask --help
btca ask -r <resource> -q "<question>"
```

- Run `btca status` when you need to confirm auth, model/provider selection, or available project resources.
- Treat `btca ask -r ... -q ...` as the canonical documented form.
- Only mention additional flags when they are verified in `btca ask --help` and materially help the task.

## Workflow

1. If BTCA availability is unclear, run `btca status`.
2. Identify the concrete question that needs fresh documentation.
3. Choose the narrowest relevant `btca` resources.
4. Run `btca ask -r ... -q ...` before relying on memory.
5. Base the answer or implementation on the `btca` result and preserve the supporting paths or URLs it returns in `Sources`.
6. If `btca` is unavailable or incomplete, say so explicitly and then fall back to local code plus official docs.

## Query Patterns

Use concise, implementation-shaped questions:

```bash
btca ask -r ai -q "How should I use structured outputs with retries?"
btca ask -r ai -r cloudflare -q "What is the recommended way to run AI SDK on Cloudflare Workers?"
btca ask -r posthog -q "How should I attach trace IDs to AI telemetry?"
btca ask -r nuqs -q "How should I manage query state in the Next.js App Router?"
btca ask -r effect-smol -q "What is the preferred Layer and service composition pattern for request-scoped dependencies?"
btca ask -r autoevals -q "Which TypeScript scorers exist for factuality and similarity-style evaluation?"
btca ask -r braintrust-sdk-javascript -q "How should I run evals and tracing from the Braintrust TypeScript SDK?"
```

Prefer one focused question over a broad catch-all query. If needed, ask a follow-up question after reading the first answer.

## Output Rules

- Summarize the recommended pattern, not just raw snippets
- Preserve the exact supporting file paths or URLs returned by `btca`
- Mention the `btca` resources you used when that context helps the reader
- Call out uncertainty when the source answer is partial
- Do not present recalled behavior as authoritative if `btca` was expected but not used

## Guardrails

- Do not invent unsupported CLI flags or undocumented `btca` behavior
- Do not use `btca` for stable repo-local conventions that are already documented in this monorepo
- Do not skip local code inspection when the task is about how this repo already integrates the SDK
- When repo behavior and external docs disagree, surface the mismatch explicitly instead of guessing
