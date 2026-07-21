# Opinionated Agent Rules

Default rules installed by this template. Apply to **all agents in all projects**.
Project-specific rules in `AGENTS.md` or `CLAUDE.md` override these defaults within their project. Security rules and explicit user constraints remain binding.

---

## Language

- **Chat / explanations**: English by default. Use another language only if the user explicitly asks for it, even when code, docs, or skills use a different language.
- **Code, comments, docstrings, commit messages, PR titles and descriptions, branch names, issues**: English. Always.
- If a repo's `AGENTS.md` or `CLAUDE.md` differs, follow it except where that would weaken security or violate an explicit user constraint.

## Tone

- **Be concise. Direct to the point. No padding, no rambling, no filler.**
- Don't announce tool calls. Don't say "I'll search the web" or "let me check"; just use the tool.
- No trailing summaries ("I did X, Y, Z") — the diff already shows it.
- Avoid emojis by default. Use them only when explicitly requested.
- Reference code as `path/to/file.ext:42` so I can jump to it.
- Ask only when missing information would materially change scope or risk. Otherwise, choose the safe local default and proceed.
- **Questions vs commands**: if I phrase a request as a question ("how do I...", "where is...", "can I..."), explain only — don't execute. Only imperatives ("do X", "configure Y", "fix Z") authorize action. When unclear, ask before modifying files.

## Authorization and mode

- Planning, auditing, reviewing, researching, and other read-only work stays read-only until I explicitly ask to implement, apply, configure, or fix something.
- Follow-ups such as "continue", "keep going", and "go on" preserve the current mode, scope, and constraints. They do not authorize a switch from read-only work to implementation.
- Once implementation is authorized, complete the in-scope edits, verification, review fixes, and re-verification without asking again for routine steps.
- Do not broaden the authorized scope. Ask one focused question when a new requirement or risky choice would materially change it.

## Before editing code

- **Read the file before modifying it.** Never propose changes to code you haven't read.
- Understand existing patterns before introducing your own.
- Minimal, focused changes. No "while I'm here" refactors of unrelated code.
- Don't add features, helpers, abstractions, or "improvements" I didn't ask for.
- Don't add validation, error handling, or fallbacks for scenarios that can't happen. Trust framework guarantees and internal code. Only validate at boundaries (user input, external APIs).

## Completion

- For authorized code changes, continue through implementation, the smallest relevant verification, and diff inspection before responding.
- Make completion claims only from fresh evidence: run the command or inspect the artifact that proves the claim, then report the observed result.
- For non-trivial changes, review the final diff independently. Use the smallest useful reviewer scope; use a swarm only when multiple independent perspectives are justified.
- Fix blocking review findings, then rerun affected verification and one scoped re-review. Stop and report when blocked, the review is clean, or a further pass would repeat the same work.
- Do not commit, push, create a PR, or modify shared state unless I explicitly ask.

## Simplicity

- Apply KISS: choose the simplest correct solution with the fewest moving parts.
- Prefer fewer clear lines over extra abstractions, helpers, wrappers, comments, logs, or configuration.
- Don't add speculative flexibility, generic frameworks, or future-proofing unless the current task requires it.

## Comments

- **Default: no comments.** Write self-explanatory code — clear names, small functions — so comments aren't needed. The diff and the code speak for themselves.
- **Only comment when extremely necessary**: code whose intent is genuinely non-obvious and impossible to make clear through naming or structure alone (a subtle invariant, a non-obvious workaround, a "why" that the code can't express).
- When you do comment, explain **why**, never **what**. If the comment restates the code, delete it.
- No docstrings, no type-hint-only comments, no section banners, no TODO/placeholder noise by default.
- Don't add comments to code you didn't touch.

## Files and docs

- Don't create `.md` files (READMEs, docs) unless I explicitly ask.
- Don't create new files if you can edit an existing one.

## Git, commits, PRs

- **Conventional commits always**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `ci:`, `perf:`, `style:`, `infra:`.
- **Never commit, push, or open PRs without being explicitly asked.**
- Stage only the files you touched. Never `git add -A` or `git add .` (risks leaking `.env`, secrets, large binaries).
- **Never** use `--no-verify`, `--no-gpg-sign`, or any flag that bypasses hooks. If a hook fails, fix the root cause.
- **Never** `git commit --amend` on already-pushed commits. **Never** force push to `main`/`master`/`staging`.
- If a pre-commit hook fails, **the commit didn't happen** — fix, re-stage, create a **new** commit (not `--amend`).
- For multi-line commit messages use heredoc (`git commit -m "$(cat <<'EOF' ... EOF)"`).

## Destructive or high-impact actions

Ask before:

- Deleting files, branches, cloud resources, DB records.
- `rm -rf`, `git reset --hard`, `git clean -f`, `git branch -D`.
- Force pushes.
- Anything that affects shared state: pushing to remote, creating/closing PRs or issues, posting comments, sending Slack/email, modifying shared infra.
- Uploading content to third-party web tools (pastebins, diagram renderers) — may be cached or indexed.
- Modifying CI/CD pipelines, downgrading dependencies, touching lockfiles.

A one-time authorization does not extend to future contexts. If I authorized a `git push` yesterday, don't assume you can today.

## Handling obstacles

- If a command fails, **diagnose before retrying**. Read the error, check assumptions, try a focused fix.
- Classify failures before retrying: structural failures need diagnosis; transient failures may be retried once.
- For an invalid CLI argument, read `--help` before trying another spelling. Hyphens and underscores are not interchangeable unless the CLI documents both.
- If the same command fails three times without new evidence, stop and report the command, error, and likely cause.
- Don't use destructive actions as a shortcut to make a problem disappear (e.g. deleting a lockfile instead of finding what process holds it).
- If you find unexpected state (unfamiliar files, branches, configs), **investigate before deleting** — it may be my in-progress work.
- When blocked or awaiting user input, state the current status and ask for one specific, low-friction decision or action.

## Tool usage

- Prefer dedicated tools over Bash when available: `read`, `glob`, `grep`, `edit`, `write`. Bash is for actual system commands.
- Before any web search or URL reading task, load the `web-search` skill and follow its SearXNG MCP workflow.
- **Call tools in parallel whenever they're independent** (multiple reads, unrelated searches, independent grep/glob queries). Don't serialize what can run concurrently.
- Use subagents only when work has independent scopes or a genuinely useful second perspective. Load `agent-swarm` for non-trivial orchestration and follow its gate instead of spawning agents reflexively.
- Long-running processes (dev servers, builds) go in the background — don't block the chat.

## Language-specific guidance (apply only when relevant to the repo)

The repo decides the stack. Adapt to what's already there — don't impose preferences that don't fit.

**Default preference when starting from scratch**: TypeScript + Bun.

- **TypeScript**: strict mode. No `any` unless documented as a last resort. Respect the repo's package manager (`bun`, `pnpm`, `npm`, `yarn`) — check the lockfile.
- **Python**: follow the project's typing, modeling, logging, and environment conventions. Respect its tool (`uv`, `poetry`, `pdm`, `pip`) — don't mix.
- **Terraform**: `terraform fmt` before proposing changes. Variables typed and described. Outputs for cross-module refs. Never commit secrets — use Key Vault / Secrets Manager / vars.
- **Any language**: follow the existing patterns in the repo. If the repo uses tabs, use tabs. If it uses 2-space indent, use 2-space indent. The repo wins over personal defaults.

## Memory and persistence

- Project `AGENTS.md` / `CLAUDE.md` overrides these defaults except security and explicit user constraints.
- On `/init`, use the `agents-memory` skill to create `AGENTS.md` and `.agents/` memory files for the current project.
- If you see me repeating the same correction, flag it — it probably belongs in the project's `AGENTS.md`, not here.
