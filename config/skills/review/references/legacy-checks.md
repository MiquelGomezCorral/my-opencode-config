# Legacy And Unnecessary Code Checks

Flag these anti-patterns during the convention audit.

1. **Legacy compatibility layers** — Old wrappers, adapters, aliases, or translation helpers left behind after the new implementation path exists.
2. **Duplicate code paths** — Keeping both the old and new flow in the same diff without showing an active migration need.
3. **Stale fallback branches** — Conditional logic that preserves obsolete behavior, deprecated shapes, or unreachable recovery paths.
4. **Unused helpers or exports** — Local functions, pass-through wrappers, dead branches, or intermediate helpers with no meaningful caller value.
5. **Just-in-case abstractions** — Indirection added without multiple call sites, real reuse, or a concrete boundary requirement.
6. **No-op normalization layers** — Mapping, cloning, or adapter code that does not materially change behavior and only obscures the data flow.
