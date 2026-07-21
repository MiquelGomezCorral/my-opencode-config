---
name: macos-computer
description: Inspect this Mac's current hardware, OS, shell, and developer toolchain when host-specific facts are relevant. Use live commands instead of relying on stored version or free-space values.
---

# macOS Computer

Use this skill only when a task depends on the host environment.

## Stable context

- Apple Silicon MacBook Air with 16 GB unified memory.
- Default shell is zsh.
- GPU workloads use Metal/MPS, not CUDA.
- Homebrew is the system package manager.

## Inspect live state

Run only the probes needed for the task:

```bash
uname -a
sw_vers
uname -m
sysctl -n machdep.cpu.brand_string
sysctl -n hw.memsize
df -h
command -v bun node python3 brew
bun --version
node --version
python3 --version
brew --version
```

Project dependencies, package managers, framework versions, and verification commands belong to each repository's `AGENTS.md` and lockfiles. Do not infer the Vidext monorepo stack from this host skill.
