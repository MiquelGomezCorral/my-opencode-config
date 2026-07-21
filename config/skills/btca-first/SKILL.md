---
name: btca-first
description: Source-first SDK and framework research with btca. Use when a task depends on current behavior or recommended usage of AI SDK, Cloudflare, Effect, PostHog, or adjacent integrations, and you want the agent to consult btca before relying on memory or generic web search.
---

# btca-first

Use this skill when the task depends on current external-library behavior, recommended integration patterns, or SDK capability checks. BTCA resources vary by project and may change between sessions, so discover the live catalog before choosing names.

## When to use

- The task asks how to use an SDK or platform feature
- The task depends on current docs or recommended patterns
- The task spans more than one vendor boundary, such as AI SDK plus Cloudflare Workers
- You need evidence from source repositories before implementing or reviewing code

## Resource Selection

1. Call `btca_listResources` or run `btca status` to inspect resources available in the current project.
2. Use only names returned by the live catalog. Common project resources may include `ai`, `cloudflare`, `effect-smol`, `posthog`, `autoevals`, `braintrust-sdk-javascript`, `nextjs`, `svelte`, and `tailwindcss`, but none are globally guaranteed.
3. Use an HTTPS Git URL or `npm:<package>` reference for a one-off source that is not configured locally.
4. Use multiple resources only when the question crosses real boundaries.

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

1. Inspect the live resource catalog unless the exact resource was already verified this session.
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
