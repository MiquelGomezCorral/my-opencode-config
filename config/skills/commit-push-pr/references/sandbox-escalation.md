# Sandbox Escalation Pattern

When `git commit` fails inside a sandboxed shell because the index lock cannot be created, retry the same commit with escalated permissions.

## Failure signal

```
fatal: Unable to create '.git/index.lock': Operation not permitted
```

## Retry parameters

When the agent runtime exposes sandbox-permission overrides:

- `sandbox_permissions=require_escalated`
- `justification`: short reason (e.g. "allow git commit outside sandbox")
- `prefix_rule`: `["git", "commit"]`

## After escalation

- Commit succeeds and proceeds through hooks normally.
- Push and PR steps run in the regular sandbox tier.

## Notes

- Only escalate the `git commit` invocation. Do not extend escalation to other commands.
- If the runtime does not expose sandbox controls, fall back to running the commit outside the sandboxed shell or asking the user to run it directly.
