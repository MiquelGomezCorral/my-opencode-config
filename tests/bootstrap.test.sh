#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TEST_HOME=$(mktemp -d)
trap 'rm -rf "$TEST_HOME"' EXIT

HOME="$TEST_HOME/original-home"
XDG_DATA_HOME="$TEST_HOME/wrong-data"
BUN_INSTALL="$TEST_HOME/wrong-bun"
export HOME XDG_DATA_HOME BUN_INSTALL

set -- --home "$TEST_HOME/home"
source "$REPO_ROOT/bootstrap.sh"

[[ "$DEPS_DIR" == "$HOME/.local/share/my-opencode-config/deps" ]]
[[ "$BUN_INSTALL" == "$HOME/.bun" ]]

mkdir -p "$CONFIG_TARGET"
ln -s "$CONFIG_SOURCE/package-lock.json" "$CONFIG_TARGET/package-lock.json"
SKIP_DEPS=true
install_config
[[ ! -L "$CONFIG_TARGET/package-lock.json" ]]

COMMAND_LOG="$TEST_HOME/commands.log"

uname() {
  printf 'Linux\n'
}

# shellcheck disable=SC2032
docker() {
  return 1
}

docker-compose() {
  return 0
}

sudo() {
  printf '%s\n' "$*" >> "$COMMAND_LOG"
  [[ "$*" == "docker info" ]] && return 0
  [[ "$1" == docker-compose ]]
}

openssl() {
  printf 'test-secret\n'
}

CONFIG_TARGET="$REPO_ROOT/config"
start_searxng

grep -q '^docker compose version$' "$COMMAND_LOG"
grep -q '^docker-compose -f .* up -d$' "$COMMAND_LOG"
