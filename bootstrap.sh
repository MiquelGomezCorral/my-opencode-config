#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OPENCODE_VERSION=1.18.3
BUN_VERSION=1.3.2
UV_VERSION=0.11.29
BTCA_VERSION=2.0.5
HEADROOM_VERSION=0.27.0
CODEGRAPH_VERSION=0.9.2
SKILLSPECTOR_VERSION=2.3.1
SKILLSPECTOR_COMMIT=6f649c3c1f52deecd5e931e646b0e8d836ab2eb6
PNPM_VERSION=11.0.0
QUOTA_REPO=https://github.com/MiquelGomezCorral/opencode-quota.git
QUOTA_COMMIT=ae4d944e56351a8dbeb8fd10aadbf6f079778741
SKIP_DEPS=false
SKIP_SERVICES=false
CHECK_ONLY=false
CHECK_DEPS=false

usage() {
  printf 'Usage: %s [--check] [--check-deps] [--skip-deps] [--skip-services] [--home PATH]\n' "$0"
}

while (($#)); do
  case "$1" in
    --check) CHECK_ONLY=true ;;
    --check-deps) CHECK_DEPS=true ;;
    --skip-deps) SKIP_DEPS=true ;;
    --skip-services) SKIP_SERVICES=true ;;
    --home)
      [[ $# -ge 2 ]] || { usage; exit 2; }
      HOME=$2
      export HOME
      XDG_CONFIG_HOME="$HOME/.config"
      XDG_DATA_HOME="$HOME/.local/share"
      BUN_INSTALL="$HOME/.bun"
      export XDG_CONFIG_HOME XDG_DATA_HOME BUN_INSTALL
      shift
      ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
  shift
done

CONFIG_SOURCE="$ROOT/config"
AGENT_SOURCE="$ROOT/agent-home"
TOOL_CONFIG_SOURCE="$ROOT/tool-config"
CONFIG_TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
AGENT_TARGET="$HOME/.agents"
BTCA_TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/btca"
DEPS_DIR="$HOME/.local/share/my-opencode-config/deps"
BACKUP_SUFFIX="backup-$(date +%Y%m%d-%H%M%S)"
CONFIG_ENTRIES=(
  opencode.json tui.json AGENTS.md security-rules.md surgical-rules.md
  warmup.sh package.json bun.lock opencode-env.sh agents commands
  plugins skills tests searxng opencode-quota
)
export PATH="$HOME/.bun/bin:$HOME/.local/bin:$HOME/.opencode/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

check_source() {
  local path
  local required=(
    agent-home/skills
    agent-home/.skill-lock.json
    tool-config/btca/btca.config.jsonc
  )

  for path in "${CONFIG_ENTRIES[@]}"; do
    [[ -e "$CONFIG_SOURCE/$path" ]] || { printf 'Missing config/%s\n' "$path" >&2; exit 1; }
  done
  for path in "${required[@]}"; do
    [[ -e "$ROOT/$path" ]] || { printf 'Missing %s\n' "$path" >&2; exit 1; }
  done

  if find "$ROOT" -type d \( -name .git -o -name node_modules -o -name .codegraph \) -prune -o -type f \
    \( -name .env -o \( -name '.env.*' ! -name .env.example \) -o -name auth.json -o -name mcp-auth.json -o -name 'opencode.db*' -o -name '*.log' \) \
    -print -quit | grep -q .; then
    printf 'Forbidden file found in repository.\n' >&2
    exit 1
  fi

  if grep -R -I -l -E '(Fe26\.2\*\*|sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)' \
    --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.codegraph "$ROOT"; then
    printf 'Credential-shaped value found in repository.\n' >&2
    exit 1
  fi

  if grep -R -I -l -E '/Users/[^/]+|OPENCODE_GO_AUTH_COOKIE|BRAINTRUST_API_KEY' \
    --exclude-dir=.git --exclude-dir=node_modules --exclude='*.md' \
    "$CONFIG_SOURCE" "$AGENT_SOURCE" "$TOOL_CONFIG_SOURCE"; then
    printf 'Machine-specific path or credential name found in config.\n' >&2
    exit 1
  fi

  if grep -E '@latest|image:[[:space:]]+[^[:space:]]*:latest' \
    "$CONFIG_SOURCE/opencode.json" "$CONFIG_SOURCE/searxng/compose.yml"; then
    printf 'Floating runtime dependency found in operational config.\n' >&2
    exit 1
  fi

  if command -v node >/dev/null 2>&1; then
    node -e 'for (const file of process.argv.slice(1)) JSON.parse(require("node:fs").readFileSync(file, "utf8"))' \
      "$CONFIG_SOURCE/opencode.json" \
      "$CONFIG_SOURCE/tui.json" \
      "$CONFIG_SOURCE/package.json" \
      "$CONFIG_SOURCE/opencode-quota/quota-toast.json" \
      "$CONFIG_SOURCE/plugins/vault-context/vault-context.config.json"
  fi
}

check_dependencies() {
  local missing=()
  local mismatched=()
  local tool
  local check_services=${1:-true}
  local required=(git node npm npx bun uv opencode btca headroom codegraph gh rg skillspector openssl sqlite3)

  $check_services && required+=(docker)
  for tool in "${required[@]}"; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if $check_services && ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    missing+=(docker-compose)
  fi
  if ((${#missing[@]})); then
    printf 'Missing required commands: %s\n' "${missing[*]}" >&2
    exit 1
  fi

  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)' || mismatched+=("node>=22.13")
  [[ "$(bun --version)" == "$BUN_VERSION" ]] || mismatched+=("bun=$BUN_VERSION")
  [[ "$(uv --version)" == "uv $UV_VERSION"* ]] || mismatched+=("uv=$UV_VERSION")
  [[ "$(opencode --version)" == "$OPENCODE_VERSION" ]] || mismatched+=("opencode=$OPENCODE_VERSION")
  [[ "$(btca --version)" == *"$BTCA_VERSION"* ]] || mismatched+=("btca=$BTCA_VERSION")
  [[ "$(headroom --version)" == *"$HEADROOM_VERSION"* ]] || mismatched+=("headroom=$HEADROOM_VERSION")
  [[ "$(codegraph --version)" == *"$CODEGRAPH_VERSION"* ]] || mismatched+=("codegraph=$CODEGRAPH_VERSION")
  [[ "$(skillspector --version)" == *"$SKILLSPECTOR_VERSION"* ]] || mismatched+=("skillspector=$SKILLSPECTOR_VERSION")
  if ((${#mismatched[@]})); then
    printf 'Unexpected dependency versions: %s\n' "${mismatched[*]}" >&2
    exit 1
  fi
}

if $CHECK_ONLY; then
  check_source
  printf 'Configuration source is valid.\n'
  exit 0
fi

if $CHECK_DEPS; then
  if $SKIP_SERVICES; then
    check_dependencies false
  else
    check_dependencies true
  fi
  printf 'All runtime dependencies are available.\n'
  exit 0
fi

install_homebrew() {
  if ! command -v brew >/dev/null 2>&1; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [[ -x /opt/homebrew/bin/brew ]]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    else
      eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi
}

install_system_dependencies() {
  case "$(uname -s)" in
    Darwin)
      install_homebrew
      brew install node openssl gh ripgrep
      if ! $SKIP_SERVICES; then
        command -v docker >/dev/null 2>&1 || brew install docker
        if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
          brew install docker-compose
        fi
        if ! docker info >/dev/null 2>&1 && ! command -v colima >/dev/null 2>&1; then
          brew install colima
        fi
      fi
      ;;
    Linux)
      [[ -r /etc/os-release ]] || { printf 'Unsupported Linux distribution.\n' >&2; exit 1; }
      # shellcheck source=/dev/null
      . /etc/os-release
      case "${ID:-}" in
        ubuntu|debian) ;;
        *) printf 'Only Ubuntu and Debian are supported.\n' >&2; exit 1 ;;
      esac
      sudo apt-get update
      sudo apt-get install -y ca-certificates curl git gnupg nodejs npm openssl sqlite3 gh ripgrep unzip tar
      if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
      fi
      if ! $SKIP_SERVICES; then
        sudo apt-get install -y docker.io
        sudo apt-get install -y docker-compose-v2 || sudo apt-get install -y docker-compose
        sudo systemctl enable --now docker
      fi
      ;;
    *) printf 'Unsupported operating system.\n' >&2; exit 1 ;;
  esac
}

install_user_dependencies() {
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$HOME/.local/bin:$HOME/.opencode/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1 || [[ "$(bun --version)" != "$BUN_VERSION" ]]; then
    curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION"
  fi
  if ! command -v uv >/dev/null 2>&1 || [[ "$(uv --version)" != "uv $UV_VERSION"* ]]; then
    curl -LsSf "https://astral.sh/uv/$UV_VERSION/install.sh" | UV_NO_MODIFY_PATH=1 sh
  fi
  if ! command -v opencode >/dev/null 2>&1 || [[ "$(opencode --version)" != "$OPENCODE_VERSION" ]]; then
    curl -fsSL https://opencode.ai/install | bash -s -- --version "$OPENCODE_VERSION" --no-modify-path
  fi

  bun install -g "btca@$BTCA_VERSION" "@colbymchenry/codegraph@$CODEGRAPH_VERSION"
  if ! command -v headroom >/dev/null 2>&1 || [[ "$(headroom --version)" != *"$HEADROOM_VERSION"* ]]; then
    uv tool install --force "headroom-ai==$HEADROOM_VERSION"
  fi
  if ! command -v skillspector >/dev/null 2>&1 || [[ "$(skillspector --version)" != *"$SKILLSPECTOR_VERSION"* ]]; then
    uv tool install --force "git+https://github.com/NVIDIA/skillspector.git@$SKILLSPECTOR_COMMIT"
  fi
}

install_quota() {
  local quota_dir="$DEPS_DIR/opencode-quota"
  local tools_dir="$DEPS_DIR/tools"
  local pnpm="$tools_dir/node_modules/.bin/pnpm"

  mkdir -p "$DEPS_DIR" "$tools_dir"
  npm install --prefix "$tools_dir" --no-save --package-lock=false "pnpm@$PNPM_VERSION"

  if [[ ! -d "$quota_dir/.git" ]]; then
    git clone "$QUOTA_REPO" "$quota_dir"
  elif [[ -n "$(git -C "$quota_dir" status --short)" ]]; then
    printf 'Dependency has local changes: %s\n' "$quota_dir" >&2
    exit 1
  fi

  git -C "$quota_dir" fetch origin
  git -C "$quota_dir" checkout --detach "$QUOTA_COMMIT"
  [[ "$("$pnpm" --dir "$quota_dir" --version)" == "$PNPM_VERSION" ]] || { printf 'Unexpected pnpm version.\n' >&2; exit 1; }
  "$pnpm" --dir "$quota_dir" install --frozen-lockfile
  "$pnpm" --dir "$quota_dir" run build
}

link_managed() {
  local source=$1
  local target=$2

  if [[ -L "$target" && "$(readlink "$target")" == "$source" ]]; then
    return
  fi
  if [[ -e "$target" || -L "$target" ]]; then
    mv "$target" "$target.$BACKUP_SUFFIX"
    printf 'Backed up %s\n' "$target"
  fi
  ln -s "$source" "$target"
}

install_config() {
  local entry

  mkdir -p "$CONFIG_TARGET" "$AGENT_TARGET" "$BTCA_TARGET"
  if [[ -L "$CONFIG_TARGET/package-lock.json" && "$(readlink "$CONFIG_TARGET/package-lock.json")" == "$CONFIG_SOURCE/package-lock.json" ]]; then
    rm "$CONFIG_TARGET/package-lock.json"
  fi
  for entry in "${CONFIG_ENTRIES[@]}"; do
    link_managed "$CONFIG_SOURCE/$entry" "$CONFIG_TARGET/$entry"
  done
  link_managed "$AGENT_SOURCE/skills" "$AGENT_TARGET/skills"
  link_managed "$AGENT_SOURCE/.skill-lock.json" "$AGENT_TARGET/.skill-lock.json"
  link_managed "$TOOL_CONFIG_SOURCE/btca/btca.config.jsonc" "$BTCA_TARGET/btca.config.jsonc"

  if ! $SKIP_DEPS; then
    bun install --cwd "$CONFIG_TARGET"
  fi
}

configure_shell() {
  local shell_name=${SHELL##*/}
  local shell_rc="$HOME/.bashrc"
  local source_line="[[ -f \"$CONFIG_TARGET/opencode-env.sh\" ]] && . \"$CONFIG_TARGET/opencode-env.sh\""

  [[ "$shell_name" == zsh ]] && shell_rc="$HOME/.zshrc"
  touch "$shell_rc"
  if ! grep -Fqx "$source_line" "$shell_rc"; then
    printf '\n%s\n' "$source_line" >> "$shell_rc"
  fi
}

start_searxng() {
  local docker_cmd=(docker)
  local compose_cmd
  local secret

  if [[ "$(uname -s)" == Darwin ]] && ! docker info >/dev/null 2>&1; then
    colima start
  fi
  if ! docker info >/dev/null 2>&1; then
    if sudo docker info >/dev/null 2>&1; then
      docker_cmd=(sudo docker)
    else
      printf 'Docker is unavailable.\n' >&2
      exit 1
    fi
  fi

  if "${docker_cmd[@]}" compose version >/dev/null 2>&1; then
    compose_cmd=("${docker_cmd[@]}" compose)
  elif command -v docker-compose >/dev/null 2>&1; then
    if [[ "${docker_cmd[0]}" == sudo ]]; then
      compose_cmd=(sudo docker-compose)
    else
      compose_cmd=(docker-compose)
    fi
  else
    printf 'Docker Compose is unavailable.\n' >&2
    exit 1
  fi

  secret=$(openssl rand -hex 32)
  SEARXNG_SECRET=$secret "${compose_cmd[@]}" -f "$CONFIG_TARGET/searxng/compose.yml" up -d
}

main() {
  check_source
  if ! $SKIP_DEPS; then
    install_system_dependencies
    install_user_dependencies
    install_quota
  fi
  install_config
  configure_shell
  if ! $SKIP_SERVICES; then
    start_searxng
  fi
  if ! $SKIP_DEPS; then
    if $SKIP_SERVICES; then
      check_dependencies false
    else
      check_dependencies true
    fi
  fi

  printf '\nInstalled OpenCode configuration.\n'
  printf 'Restart your shell, then authenticate with: opencode auth login\n'
  printf 'Authenticate remote MCPs as needed with: opencode mcp auth <name>\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main
fi
