#!/bin/bash
DB="$HOME/.local/share/opencode/opencode.db"

tmpdir=$(mktemp -d); trap 'rm -rf "$tmpdir"' EXIT
cd "$tmpdir" && git init -q

pids=()
for m in opencode/deepseek-v4-flash-free anthropic/claude-haiku-4-5 openai/gpt-5.4; do
  opencode run --model "$m" --title "warmup" --format json "hi" >/dev/null 2>&1 &
  pids+=($!)
done

sleep 15
kill "${pids[@]}" 2>/dev/null
sqlite3 "$DB" "DELETE FROM session WHERE title = 'warmup';" 2>/dev/null
echo "done"
