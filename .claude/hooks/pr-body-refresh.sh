#!/usr/bin/env bash
set -uo pipefail

[[ $(jq -r '.tool_input.command // ""') == *"git push"* ]] || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
pr=$(gh pr view "$branch" --json number,state -q 'select(.state == "OPEN") | .number' 2>/dev/null) || exit 0
[[ -n $pr ]] || exit 0

context="You pushed to $branch, which has open PR #$pr. Before ending the turn, read its body (gh pr view $pr --json title,body) and rewrite it with the pr skill so Summary, Evidence, Not verified and Merge Danger describe the PR as it now stands (gh pr edit $pr --body-file <file>). Skip only if these commits change nothing the body says."
jq -n --arg c "$context" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $c}}'
