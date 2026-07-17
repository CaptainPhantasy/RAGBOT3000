#!/usr/bin/env bash
set -euo pipefail

base="d88b79c99505fad8b34d3f3dd3300f50c91972d6"

scan_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local output
    if ! output=$(gitleaks dir "$file" --redact --no-banner 2>&1); then
      printf '%s\n' "$output"
      return 1
    fi
  fi
}

while IFS= read -r -d '' file; do
  scan_file "$file"
done < <(git diff --name-only --diff-filter=ACMRTUXB -z "$base"...HEAD --)

while IFS= read -r -d '' file; do
  scan_file "$file"
done < <(git diff --name-only --diff-filter=ACMRTUXB -z HEAD --)

while IFS= read -r -d '' file; do
  scan_file "$file"
done < <(git ls-files --others --exclude-standard -z)

echo "recovery sensitive-data scan passed"
