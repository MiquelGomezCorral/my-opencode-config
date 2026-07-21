---
name: diagnosing-bugs
description: Diagnose hard bugs and performance regressions with a reproducible feedback loop. Use when a failure is intermittent, poorly understood, repeatedly misdiagnosed, or needs root-cause evidence before a fix. Skip for obvious one-line errors with a proven cause.
---

# Diagnosing Bugs

## Workflow

1. Build the tightest runnable signal for the reported symptom: a focused test, CLI invocation, request replay, browser check, benchmark, or minimal harness.
2. Reproduce the user's actual failure and minimize the input or path while keeping it red.
3. Rank a few falsifiable hypotheses. Test the cheapest discriminating prediction first and change one variable at a time.
4. Instrument only boundaries that distinguish hypotheses. Tag temporary diagnostics so they can be removed reliably.
5. Turn the minimized reproduction into a regression check at the closest correct seam, then apply the smallest root-cause fix.
6. Rerun the original reproduction, the regression check, and relevant surrounding verification. Remove temporary diagnostics and artifacts.

## Guardrails

- Do not fix before reproducing unless the defect is directly proven by static evidence.
- Do not treat a nearby failure as the reported bug.
- Do not retry the same hypothesis without new evidence.
- If a deterministic reproduction is impossible, raise the failure rate or capture a concrete artifact. When still blocked, state what was attempted and ask for one missing artifact or access requirement.
- For performance regressions, measure a baseline before changing code and compare the same workload afterward.

## Report

State the reproduction command, root cause, fix, regression coverage, and fresh verification result. Distinguish proven facts from remaining uncertainty.
