# Effect Review Checks

Apply these checks when the reviewed diff touches Effect code. Load `btca-first` only when current upstream guidance is needed and `effect-smol` exists in the live resource catalog.

1. **Use `btca` before asserting current `effect-smol` guidance** — Run `btca ask -r effect-smol -q "..."` before judging current API usage, recommended composition, or preferred patterns that may have changed upstream.
2. **Use repo patterns for repo-local conventions** — Compare upstream guidance against nearby code and project instructions. If repo behavior and external guidance disagree, report the mismatch explicitly instead of guessing.
3. **Prefer repo-standard Effect composition** — Flag custom wrappers when the repo already has a clear `Effect.fn`, `Effect.gen`, `createEffectTool`, or `createEffectRunner` pattern.
4. **Prefer typed error channels** — Flag promise-style error handling or untyped throws where `Schema.TaggedErrorClass`, `Effect.try`, or `Effect.tryPromise` should carry the failure.
5. **Prefer runtime injection via services and layers** — Flag ad hoc closures or inline dependency wiring when `ServiceMap.Service` and `Layer` are the established pattern.
6. **Require explicit concurrency choices** — Flag `Effect.forEach` or `Effect.all` usage that relies on implicit concurrency in workflows that can grow.
7. **Remove legacy promise glue** — Flag bridged Promise helpers, scattered `Effect.runPromise(...)`, or dual Promise/Effect code paths when the repo-standard runner exists.
8. **Avoid unnecessary named types around pipelines** — Flag local aliases added only to explain or constrain a pipeline shape that TS can infer inline.
