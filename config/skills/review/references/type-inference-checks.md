# Type Inference Checks

Flag these anti-patterns during the convention audit. Derived from the **Type Inference (Critical Rule)** in `AGENTS.md`.

1. **Shuttle types** — A type defined only to annotate a single function's return. If the type has one usage site and that site is a return annotation, flag it. Let TS infer the return instead.
2. **Explicit return type annotations** — On internal/private functions where TS can infer the type from the implementation. Exported public API boundaries are acceptable.
3. **Manual literal unions** — String or number unions written by hand (e.g. `type Provider = "openai" | "fal"`) instead of derived from an `as const` array or constant.
4. **Manual schema types** — Hand-written row/insert types for Drizzle tables instead of using `InferSelectModel` / `InferInsertModel`.
5. **Manual package types** — Re-declaring types that a package already exports (e.g. re-defining `WorkflowEvent` or `ToolCallPart` instead of importing them).
6. **Explicit variable annotations with inferable initializers** — Local `const` or `let` annotations that restate the initializer type without protecting a boundary or narrowing semantics.
7. **Manual callback or local function signatures** — Local aliases or inline annotations that TS can infer from assignment, parameters, or call sites.
8. **Hand-written shapes duplicating inferred data** — Local object, result, or config types that duplicate package exports, schema inference, or the return shape of a nearby function.
9. **Redundant generic arguments** — Explicit generic parameters passed where TypeScript already infers the same type from the arguments.
10. **Defensive type stabilization without evidence** — Added annotations justified only by habit or fear of inference drift, without an actual compiler limitation or public API need.
