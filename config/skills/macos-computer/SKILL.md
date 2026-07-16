---
name: macos-computer
description: "Technical specifications and dev stack for this MacBook Air running the Vidext monorepo. Use when OS, hardware, or toolchain details are relevant to a task or needed to fix something."
---
# Host Environment: macOS 15.2 Sequoia
- **Model:** MacBook Air (Mac15,12)
- **Chip:** Apple M3 (ARM64) — 4 performance + 4 efficiency cores
- **GPU:** Apple M3 integrated — 10-core GPU, Metal 3
- **RAM:** 16 GB unified memory (shared CPU/GPU)
- **Storage:** 251 GB NVMe SSD (APFS) — ~117 GB free
- **Kernel:** Darwin 24.2.0 (xnu-11215.61.5, ARM64)

# Critical Runtime Context
- **Shell:** `/bin/zsh`
- **Runtime:** Bun 1.3.2 (primary), Node.js v25.9.0
- **Package Manager:** Bun 1.3.14 (pinned in `packageManager` field) — never npm or pnpm
- **System tools:** Homebrew 5.1.9 (`brew`) for system-level installs
- **Default Python:** 3.9.6 (`/usr/bin/python3`, Xcode CLT) — no conda
- **No CUDA:** M3 uses Metal/MPS — use `torch.backends.mps` for any ML tasks

# Vidext Monorepo Stack
- **Monorepo:** Turborepo 2.9.12 + Bun workspaces
- **Language:** TypeScript 6.0.3 (strict mode)
- **Framework:** Next.js 16.2.6 (App Router) + React 19.2.6
- **API:** tRPC v11.17 + TanStack Query 5.100
- **Validation:** Effect Schema + Standard Schema adapters
- **Database:** PostgreSQL + Drizzle ORM 1.0 rc
- **Auth:** better-auth 1.6
- **Workers:** Cloudflare Workers + Wrangler 4.90
- **AI/LLM:** Vercel AI SDK 7, Cloudflare AI
- **Styling:** Tailwind CSS 4.3.0
- **Linter/Formatter:** Biome 2.4
- **Storage:** Cloudflare R2
- **Cache:** Upstash Redis + Ratelimit
- **Analytics:** PostHog
- **Payments:** Polar SDK

# Key Commands
```bash
bun install              # install deps
bun dev                  # start all apps
bun build                # build all
bun typecheck            # TypeScript check (Turbo, concurrency=2)
bun run typecheck:safety # safety gate (ts-safety + db migrations)
bun format               # Biome check
bun format:fix           # Biome check --write
```

# Instructions
- **Always use `bun`** — never `npm`, `npx`, or `pnpm`.
- Shell scripts must target **zsh on macOS (Darwin)**. No `apt` — use `brew`.
- ARM64: verify package ARM compatibility before suggesting installs.
- No conda — use `pip3` or `python3 -m venv` for any Python work.
- For ML/GPU: Apple MPS only (`torch.backends.mps`), not CUDA.
- Run `bun typecheck && bun run typecheck:safety && bun format` before claiming any change is complete.
