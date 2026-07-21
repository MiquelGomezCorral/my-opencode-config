---
name: skillspector
description: Security scanner for AI agent skills. Scan skills, repositories, or directories for vulnerabilities before installing. Trigger on "scan skill", "check skill safety", "audit skill", "skill security", "skillspector", "is this skill safe".
---

# SkillSpector

Security scanner for AI agent skills. Detects 64 vulnerability patterns across 16 categories before you install agent skills.

## When to use

- Before installing a new skill (scan its repo, directory, or zip).
- When user asks "is this skill safe?" or "audit this skill".
- After creating a new skill locally — scan it before sharing.
- When evaluating a third-party skill from a marketplace.

## Scanning

```bash
# Scan a local skill directory
skillspector scan ./my-skill/

# Scan a Git repository
skillspector scan https://github.com/user/my-skill

# Scan a single SKILL.md file
skillspector scan ./SKILL.md

# Scan a zip file
skillspector scan ./my-skill.zip

# Static analysis only (faster, no LLM needed)
skillspector scan ./my-skill/ --no-llm
```

## Output formats

```bash
# JSON (machine-readable)
skillspector scan ./my-skill/ --format json --output report.json

# Markdown
skillspector scan ./my-skill/ --format markdown --output report.md

# SARIF (CI/CD integration)
skillspector scan ./my-skill/ --format sarif --output report.sarif
```

## LLM analysis

For higher precision (~87%), configure an LLM backend:

```bash
# Anthropic
export SKILLSPECTOR_PROVIDER=anthropic
export ANTHROPIC_API_KEY=<your-api-key>
skillspector scan ./my-skill/

# OpenAI
export SKILLSPECTOR_PROVIDER=openai
export OPENAI_API_KEY=<your-api-key>
skillspector scan ./my-skill/

# Skip LLM for static-only scan
skillspector scan ./my-skill/ --no-llm
```

## Aggressiveness caveat

Static analysis (Stage 1, `--no-llm`) is regex-based and **aggressive with false positives**. It flags anything matching a pattern without understanding context. Known false-positive patterns:

- **Binary files** (PNG, PDF): regex matches binary noise — always ignore hits on non-text files
- **Docs referencing env vars**: `ANTHROPIC_API_KEY` in READMEs or examples is documentation, not harvesting
- **LICENSE files**: scope creep hits on legal boilerplate — ignore
- **Test fixtures**: credential/agent path references in test files are legitimate
- **Plugin infrastructure**: flag files, config reads, statusline scripts are normal plugin patterns, not persistence or config access attacks
- **Eval/test scripts invoking `claude -p`**: subprocess calls with filtering specific env vars (like `CLAUDECODE`) are legitimate eval harnesses, not harvesting

A CRITICAL score from static analysis alone is **not a verdict** — it means "these patterns matched, investigate further." Always read the actual code at the flagged locations before concluding.

## Interpreting results

| Score | Severity | Recommendation |
|-------|----------|----------------|
| 0-20 | LOW | SAFE |
| 21-50 | MEDIUM | CAUTION |
| 51-80 | HIGH | DO NOT INSTALL |
| 81-100 | CRITICAL | DO NOT INSTALL |

Scores 51+ require **manual verification**: open each flagged file at each flagged line, read the code, and determine if the pattern is malicious or expected.

## Workflow

1. User provides a skill path, URL, or repo.
2. Run `skillspector scan <target> --no-llm` for the static pass.
3. For each finding, **read the actual code** at the flagged file:line.
4. Cross-reference: is it docs, test fixtures, binary assets, or real executable logic?
5. For plugins with many files, prioritize findings on executable scripts over markdown/docs/assets.
6. Check the source's reputation (stars, official status, community reviews).
7. Report findings distinguishing false positives from real concerns.
8. If uncertain, recommend running with LLM analysis (`--no-llm` off) for semantic evaluation.
