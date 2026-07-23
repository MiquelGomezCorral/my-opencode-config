---
name: task-model-recovery
description: Explain or use automatic OpenCode subagent model recovery. Use when selecting a model for a subagent, diagnosing fallback behavior, or handling a final task failure after all configured models were attempted.
---

# Task Model Recovery

The local `task` tool owns model selection and recovery. Do not manually replay failed subagent prompts.

## Model order

Without overrides:

1. The subagent's configured model.
2. `openai/gpt-5.5`.
3. `opencode/big-pickle`.

`model` replaces only the first attempt and keeps the default fallbacks. `models` defines the exact ordered chain and adds no implicit fallbacks. Never pass both.

Default chains skip duplicates. Exact `models` chains preserve supplied order and repeats. Immediate SDK errors, provider retry states, assistant message errors, `session.error` events, timeouts, and empty/no-token responses advance to the next model in a fresh child session.

Each fallback uses a fresh temporary child session. Provider retry states abort the active child before fallback. Cancelling a foreground task also aborts its active child and stops further fallbacks. Terminal child sessions are deleted after their output is captured.

## Calls

Use the configured model:

```js
task({
  description: "Short task name",
  prompt: "The complete subagent task",
  subagent_type: "explore"
})
```

Select the first model explicitly:

```js
task({
  description: "Short task name",
  prompt: "The complete subagent task",
  subagent_type: "explore",
  model: "openai/gpt-5.6-luna"
})
```

Use an exact chain when the user names model order or restricts providers:

```js
task({
  description: "Short task name",
  prompt: "The complete subagent task",
  subagent_type: "explore",
  models: ["openai/gpt-5.6-luna", "openai/gpt-5.5"]
})
```

`models: ["provider/model"]` means that model only. Translate constraints such as "OpenAI only" into an exact OpenAI chain; do not leave them only in the worker prompt.

## Expected result

- Success reports `state="completed"`, the model used, and attempted models.
- Exhausted default or exact chains report `state="error"` to the parent instead of hanging.
- Background tasks wait until the parent is ready, then inject the same completed or error result.
- Terminal child sessions are deleted so they do not accumulate in chat lists.

The tool preserves the caller's `task` permission check and parent deny/external-directory rules. `answer` cannot use it. `code-reviewer` can use it only for its allowed reviewer subagents.

## Report

After `state="error"`, report that every attempted model failed. Do not launch another duplicate child unless the user requests a retry.
