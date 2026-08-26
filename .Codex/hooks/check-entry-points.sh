#!/bin/bash
set -euo pipefail

PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null) || exit 0

# Skip if no file path or if editing AGENTS.md itself (avoid loops)
[ -z "$FILE_PATH" ] && exit 0
[[ "$FILE_PATH" == *AGENTS.md ]] && exit 0

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
AGENTS_FILE="$REPO_ROOT/AGENTS.md"
[ ! -f "$AGENTS_FILE" ] && exit 0

REL_PATH="${FILE_PATH#$REPO_ROOT/}"

# Already listed in AGENTS.md — nothing to flag
grep -qF "$REL_PATH" "$AGENTS_FILE" && exit 0

# Extract directories from backtick-delimited paths in "Entry points:" lines
FEATURE_DIRS=$(grep '^Entry points:' "$AGENTS_FILE" | grep -o '`[^`]*`' | tr -d '`' | while read -r path; do dirname "$path" 2>/dev/null; done | sort -u)

[ -z "$FEATURE_DIRS" ] && exit 0

while IFS= read -r dir; do
  if [[ "$REL_PATH" == "$dir/"* ]]; then
    FEATURE=$(awk -v dir="$dir" '
      /^### /{name=substr($0,5)}
      /^Entry points:/ && index($0, dir){print name; exit}
    ' "$AGENTS_FILE")
    [ -z "$FEATURE" ] && FEATURE="$dir"
    echo "File '$REL_PATH' is in the '$FEATURE' feature area but not listed as an entry point. If this is a key file (route, service, model, schema), update the entry points in AGENTS.md."
    exit 0
  fi
done <<< "$FEATURE_DIRS"
