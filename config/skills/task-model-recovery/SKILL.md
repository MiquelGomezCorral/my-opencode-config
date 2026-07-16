---
name: task-model-recovery
description: Explain or use automatic OpenCode subagent model recovery. Use when selecting a model for a subagent, diagnosing fallback behavior, or handling a final task failure after all configured models were attempted.
---

# Task Model Recovery

The local `task` tool owns model selection and recovery. Do not manually replay failed subagent prompts.

## Model order

1. The `model` argument when supplied, otherwise the subagent's configured model.
2. `openai/gpt-5.5`.
3. `opencode/big-pickle`.

Duplicate models are skipped. `session.error` events, timeouts, and empty/no-token responses advance to the next model in a fresh child session.

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

## Expected result

- Success reports `state="completed"`, the model used, attempted models, and all child session IDs.
- Exhausted fallbacks report `state="error"` to the parent instead of hanging.
- Background tasks inject the same completed or error result into the parent session.

The tool preserves the caller's `task` permission check and parent deny/external-directory rules. `answer` cannot use it. `code-reviewer` can use it only for its allowed reviewer subagents.

## Report

After `state="error"`, report that every attempted model failed. Do not launch another duplicate child unless the user requests a retry.
