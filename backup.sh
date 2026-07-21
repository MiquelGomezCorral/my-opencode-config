#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MESSAGE=

usage() {
  printf 'Usage: %s -m "commit message"\n' "$0"
}

while (($#)); do
  case "$1" in
    -m|--message)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      MESSAGE=$2
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
  shift
done

[[ -n "$MESSAGE" ]] || { usage; exit 2; }

cd "$ROOT"

git status --short
git diff
./bootstrap.sh --check

git add \
  .agents \
  backup.sh \
  bootstrap.sh \
  README.md \
  config/AGENTS.md \
  config/security-rules.md \
  config/tui.json \
  config/warmup.sh \
  config/opencode.json \
  config/opencode-env.sh \
  config/package.json \
  config/bun.lock \
  config/agents \
  config/commands \
  config/plugins \
  config/skills \
  config/tests \
  config/searxng \
  config/opencode-quota \
  agent-home \
  tool-config

if git diff --cached --quiet; then
  printf 'No backup changes to commit.\n'
  exit 0
fi

git commit -m "$MESSAGE"
git push
