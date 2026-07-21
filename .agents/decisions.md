# Decisions

## Active Decisions

- The GitHub repository is private.
- Git stores configuration but never credentials, sessions, or runtime state.
- The repository is canonical and installed through symlinks.
- macOS and Ubuntu/Debian are the supported platforms.
- Ponytail and Vault Context are vendored snapshots; OpenCode Quota is cloned and built at a pinned commit.
- OpenCode-facing runtimes and packages are pinned; Homebrew and apt provide current compatible platform packages.
- SearXNG's local-only secret rotates on bootstrap and is never stored in Git or a local credential file.
- Vault Context remains in automatic mode; prompts can opt out explicitly.
- OpenCode Queue remains the sole idle-session queue. Do not add another plugin that owns the same idle event without resolving the conflict first.
- Ponytail registers its five commands through its OpenCode plugin and defaults to `full`.
- The global command files are limited to `/commit`, `/index`, `/init`, and `/review`.
- `review-swarm-upstream` is project-only under `.agents/skills`; it must not be installed globally.
- `cgaravitoq/my-opencode` is an untrusted reviewer-only reference. Personal rules, project catalogs, installers, plugins, permissions, and new reviewer roles are never imported automatically.
