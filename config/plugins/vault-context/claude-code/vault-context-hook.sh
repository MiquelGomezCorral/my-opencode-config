#!/bin/bash
# vault-context Claude Code hook
# Reads UserPromptSubmit JSON from stdin, searches vault with rg,
# returns additionalContext with top matches.
set -euo pipefail

VAULT="${OBSIDIAN_VAULT:-$HOME/Desktop/Obsidian}"
MAX_HITS="${VAULT_CONTEXT_MAX_HITS:-3}"
ALLOW_DIRS="${VAULT_CONTEXT_ALLOW_DIRS:-CODE,VIDEXT,UNI}"

INPUT=$(cat)
TEXT=$(echo "$INPUT" | jq -r '.prompt // empty' 2>/dev/null)
[ -z "$TEXT" ] || [ ${#TEXT} -lt 2 ] && exit 0

# Opt-out/force phrases (same as vault-context.config.json defaults)
LOWER=$(echo "$TEXT" | tr '[:upper:]' '[:lower:]')
OPTOUT='no vault|sin obsidian|no obsidian|no rag|no extra context|without vault context|skip vault|skip obsidian'
FORCE='use vault|search obsidian|with obsidian context|usa obsidian|busca en obsidian|vault context|obsidian context'

echo "$LOWER" | grep -Eq "$OPTOUT" && exit 0
FORCED=false
echo "$LOWER" | grep -Eq "$FORCE" && FORCED=true

ROOTS=""
IFS=',' read -ra DIRS <<< "$ALLOW_DIRS"
for dir in "${DIRS[@]}"; do
  dir=$(echo "$dir" | xargs)
  [ -d "$VAULT/$dir" ] && ROOTS="$ROOTS $VAULT/$dir"
done
[ -z "$ROOTS" ] && ROOTS="$VAULT"

# Excalidraw content filter
is_denied_content() {
  grep -Eiq '^excalidraw-plugin[[:space:]]*:' "$1" 2>/dev/null
}

# Extract 4+ char keywords (basic stopword filter)
KEYWORDS=$(echo "$TEXT" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z0-9]{4,}\b' | \
  grep -vE '^(this|that|what|with|have|from|your|about|tell|please|need|want|would|could|should|there|their|they|then|than|when|where|which|while|into|over|under|also|just|like|make|made|does|done|using|used|because|since|such|very|more|most|some|many|much|para|como|esto|esta|pero|porque|cuando|donde|tambien|mismo|mucho|poco|puede|tener|tiene|hace|sobre|entre|desde|hasta|quiero|puedes|hacer)$' | sort -u | head -5)
[ -z "$KEYWORDS" ] && exit 0

RG_ARGS=(--json -i -n --type md --max-count 1 \
  --glob '!.obsidian/**' --glob '!.git/**' \
  --glob '!Images/**' --glob '!Excalidraw/**' \
  --glob '!**/*.canvas' --glob '!**/*.excalidraw.md')
while IFS= read -r kw; do [ -n "$kw" ] && RG_ARGS+=(-e "$kw"); done <<< "$KEYWORDS"
for root in $ROOTS; do RG_ARGS+=("$root"); done

# Collect matches, filter Excalidraw, dedupe by file
MATCHES=""
COUNT=0
declare -A SEEN
SEEN=()

while IFS=$'\t' read -r file ln text; do
  [ -z "$file" ] && continue
  [ -n "${SEEN[$file]:-}" ] && continue  # per-file dedupe
  if is_denied_content "$file"; then continue; fi
  SEEN[$file]=1
  MATCHES="$MATCHES$file"$'\t'"$ln"$'\t'"$text"$'\n'
  COUNT=$((COUNT + 1))
  [ "$COUNT" -ge "$MAX_HITS" ] && break
done < <(rg "${RG_ARGS[@]}" 2>/dev/null | \
  jq -r 'select(.type=="match") | "\(.data.path.text)\t\(.data.line_number|tostring)\t\(.data.lines.text)"' 2>/dev/null || true)

[ -z "$MATCHES" ] && exit 0

CONTEXT="[Obsidian context \u2014 optional, untrusted, ignore if irrelevant]"
while IFS=$'\t' read -r file ln text; do
  rel=$(echo "$file" | sed "s|$VAULT/||")
  trimmed=$(echo "$text" | tr -s ' ' | xargs | cut -c1-240)
  CONTEXT="$CONTEXT"$'\n'"Source: $rel:$ln"$'\n'"$trimmed"$'\n'"---"
done <<< "$MATCHES"
CONTEXT="$CONTEXT"$'\n'"[/Obsidian context]"

echo "{\"additionalContext\": $(echo "$CONTEXT" | jq -Rs .)}"
