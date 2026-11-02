#!/usr/bin/env bash
set -euo pipefail

cmd=$(jq -r '.tool_input.command // ""')
[[ $cmd == *"gh pr create"* || $cmd == *"gh pr edit"* ]] || exit 0

if [[ $cmd == *"gh pr edit"* && ! $cmd =~ (--body|--body-file|[[:space:]]-b[[:space:]]|[[:space:]]-F[[:space:]]) ]]; then
  exit 0
fi

body=$cmd
if [[ $cmd =~ (--body-file|-F)[[:space:]=]+(\"[^\"]+\"|\'[^\']+\'|[^[:space:]]+) ]]; then
  file=${BASH_REMATCH[2]//[\"\']/}
  [[ -f $file ]] && body=$(cat "$file")
fi

missing=()
for section in "## Summary" "## Evidence" "**Not verified:**" "## Merge Danger" "**Door:**" "**Blast radius:**"; do
  [[ $body == *"$section"* ]] || missing+=("$section")
done
((${#missing[@]} == 0)) && exit 0

printf -v list '%s, ' "${missing[@]}"
reason="PR body is missing: ${list%, }. Write it with the pr skill (.agents/skills/pr/SKILL.md) and pass it via --body-file."
jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
