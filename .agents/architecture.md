# Architecture

## Stack

Bash installer, OpenCode JSON configuration, local JavaScript plugins, Markdown agents and skills, Docker Compose for SearXNG.

## Layout

- `config/` mirrors managed paths under `~/.config/opencode`.
- `agent-home/` mirrors managed global paths under `~/.agents`.
- `.agents/` stores this repository's memory and project-only skills.
- `tool-config/` stores non-secret supporting CLI configuration.
- `bootstrap.sh` installs dependencies and creates symlinks.

## Boundaries

The repository contains reproducible configuration only. Authentication, sessions, runtime databases, logs, caches, and machine-local secrets stay outside Git.

## Entry Points

`bootstrap.sh` installs or checks the configuration. `config/opencode.json` is the main OpenCode configuration. Local plugins own their command registration; project-only skills are not installed globally.
