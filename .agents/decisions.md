# Decisions

## Active Decisions

- The GitHub repository is private.
- Git stores configuration but never credentials, sessions, or runtime state.
- The repository is canonical and installed through symlinks.
- macOS and Ubuntu/Debian are the supported platforms.
- Ponytail and Vault Context are vendored snapshots; OpenCode Quota is cloned and built at a pinned commit.
- OpenCode-facing runtimes and packages are pinned; Homebrew and apt provide current compatible platform packages.
- SearXNG's local-only secret rotates on bootstrap and is never stored in Git or a local credential file.
